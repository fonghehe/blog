---
title: "前端測試金字塔重構：從單元到 E2E 的策略演進"
date: 2026-07-31 19:23:17
tags:
  - 測試
  - 工程化
readingTime: 7
description: "傳統測試金字塔模型在前端領域水土不服。本文從 Testing Trophy 模型出發，重新審視前端測試的分層策略：單元測試的邊界、組件測試的查詢哲學、視覺回歸、契約測試、E2E 成本控制，以及 CI 中的分層執行策略。"
wordCount: 3300
---

"測試金字塔"——底座大量單元測試、中間集成測試、頂層少量 E2E 測試——這個模型從 2009 年提出以來一直被奉爲圭臬。但在前端領域，直接套用這個模型會導致大量低價值測試和脆弱的 E2E 套件。2026 年的前端測試策略需要重新審視分層邏輯。

## 傳統測試金字塔在前端的問題

經典測試金字塔的假設是：單元測試最便宜最快速，應該佔絕大多數；E2E 測試最貴最慢，應該儘量少。這個假設在後端服務中基本成立——一個函數輸入輸出明確，mock 掉數據庫就是純單元測試。

但前端的"單元"定義模糊。一個 React 組件的"單元"是什麼？是組件函數本身？還是渲染出來的 DOM？還是用戶交互的完整流程？如果把組件的內部實現細節（state 變化、內部函數調用）作爲單元測試目標，測試會變得極度脆弱——每次重構都要改測試，測試不是在驗證行爲而是在綁定實現。

更深層的問題是：前端的價值在於用戶交互體驗，而體驗是由組件組合產生的。單獨測一個 Button 組件的 onClick 觸發，幾乎沒有信息量——真正會出 Bug 的地方是 Button 在 Form 中的提交流程、在 Modal 中的關閉行爲、在異步加載中的禁用狀態。這些都不是純單元測試能覆蓋的。

## Testing Trophy：2026 年的前端測試分層

Kent C. Dodds 提出的 Testing Trophy 模型更契合前端實際。它的分層從底到頂是：

- **靜態檢查**（ESLint + TypeScript）：零成本捕獲大量類型和語法錯誤
- **單元測試**：測試純函數和工具邏輯
- **集成測試**（佔比最大）：測試組件組合、交互流程
- **E2E 測試**：少量關鍵路徑的端到端驗證

關鍵變化是集成測試成爲主力。前端大部分測試價值來自"組件在真實環境中的交互行爲"，而不是孤立的函數調用。

## 單元測試的邊界：哪些該測，哪些不該測

單元測試適合的是**純函數**——輸入決定輸出，沒有副作用，不依賴外部狀態。前端的純函數主要是：

- 工具函數（格式化、計算、驗證）
- 狀態選擇器（從 store 中派生數據）
- 業務邏輯函數（價格計算、權限判斷）
- reducer / 狀態轉換函數

```typescript
// utils/price.ts - 純函數，適合單元測試
export function calculateDiscountedPrice(
  price: number,
  discount: { type: 'percentage' | 'fixed'; value: number },
  quantity: number = 1,
): number {
  const subtotal = price * quantity;
  if (discount.type === 'percentage') {
    return Math.round(subtotal * (1 - discount.value / 100) * 100) / 100;
  }
  return Math.max(0, subtotal - discount.value * quantity);
}

// price.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscountedPrice } from './price';

describe('calculateDiscountedPrice', () => {
  it('百分比折扣正確計算', () => {
    expect(calculateDiscountedPrice(100, { type: 'percentage', value: 20 }))
      .toBe(80);
  });

  it('固定折扣不低於 0', () => {
    expect(calculateDiscountedPrice(10, { type: 'fixed', value: 50 }))
      .toBe(0);
  });

  it('批量購買正確應用折扣', () => {
    expect(calculateDiscountedPrice(50, { type: 'percentage', value: 10 }, 3))
      .toBe(135);
  });
});
```

**不該做單元測試的**：組件的內部狀態機、渲染輸出、事件處理。這些應該留給集成測試覆蓋。判斷標準很簡單——如果重構組件實現（不改行爲）會導致測試失敗，那這個測試就是在測實現細節而非行爲。

## 組件測試：Testing Library 的查詢哲學

Testing Library 的核心理念是"以用戶能感知的方式查詢 DOM"——不通過組件實例方法或內部 state，而是通過角色（role）、文本內容、標籤關聯等用戶視角的查詢方式。

```typescript
// LoginForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('提交有效憑據後調用 onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);

    // 用 role + name 查詢，模擬用戶視角
    await user.type(screen.getByRole('textbox', { name: /郵箱/i }), 'user@test.com');
    await user.type(screen.getByLabelText(/密碼/i), 'password123');
    await user.click(screen.getByRole('button', { name: /登錄/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });

  it('空字段顯示驗證錯誤', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /登錄/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('請輸入郵箱');
  });

  it('提交期間禁用按鈕', async () => {
    const user = userEvent.setup();
    // 模擬慢速響應
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));

    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByRole('textbox', { name: /郵箱/i }), 'user@test.com');
    await user.type(screen.getByLabelText(/密碼/i), 'password123');
    await user.click(screen.getByRole('button', { name: /登錄/i }));

    expect(screen.getByRole('button', { name: /提交中/i })).toBeDisabled();

    resolveSubmit!();
    // 等待按鈕恢復
    await screen.findByRole('button', { name: /登錄/i });
  });
});
```

查詢優先級是 Testing Library 最有價值的設計決策：`getByRole` > `getByLabelText` > `getByText` > `getByTestId`。優先用語義化查詢不僅讓測試更健壯，還能倒逼組件的可訪問性——如果測試中找不到 `role`，說明組件缺少 ARIA 屬性，這本身就是一個可訪問性缺陷。

## 視覺回歸測試：Storybook + Chromatic

功能測試驗證交互行爲，但無法捕獲視覺退化——CSS 改動導致間距偏移、字體回退、顏色對比度變化。視覺回歸測試通過截圖對比填補這個空缺。

```typescript
// stories/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: { viewports: [320, 768, 1200] },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: '點擊我' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: '點擊我', disabled: true },
};

// 交互測試也可以在 Storybook 中運行
export const FormSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText('已提交')).toBeVisible();
  },
};
```

Chromatic 的優勢在於它理解組件級別的視覺差異——不會因爲瀏覽器抗鋸齒的細微差異報假陽性，而是基於感知差異（perceptual difference）判斷。團隊需要設定一個閾值策略：低於 0.1% 的差異自動通過，高於則人工審核。

## 契約測試：前後端協作的保障

前後端分離架構中，一個高頻出現的 Bug 是：後端改了 API 響應結構，前端沒有同步更新，直到用戶報障才發現。契約測試通過讓前後端共享一份 API 契約定義來防止這類問題。

Pact 是最成熟的契約測試框架，但消費端驅動契約（CDC）的完整流程較重。2026 年更輕量的方案是用 OpenAPI Schema 做契約驗證：

```typescript
// tests/contract/user-api.contract.test.ts
import { describe, it, expect } from 'vitest';
import { openapiSchema } from '../schemas/user-api.schema';
import { fetchUser } from '@/api/user';

describe('User API 契約', () => {
  it('GET /users/:id 響應符合 schema', async () => {
    const response = await fetchUser('123');

    // 用 OpenAPI schema 驗證響應結構
    const validator = new OpenAPIValidator(openapiSchema);
    const result = validator.validateResponse('/users/{id}', 'get', 200, response);

    expect(result.valid).toBe(true);
  });

  it('前端類型定義與 API schema 一致', () => {
    // 編譯期保證：前端 User 類型從 schema 生成
    // 如果 schema 變了，生成的類型也會變，編譯報錯
    const user: User = {
      id: '123',
      email: 'test@example.com',
      profile: { name: 'Test', avatar: null },
    };
    expect(user).toBeDefined();
  });
});
```

更理想的工作流是：後端維護 OpenAPI Schema 文件，前端通過 `openapi-typescript` 生成 TypeScript 類型，CI 中驗證 schema 與實際 API 響應的一致性。這樣契約變更在編譯期就能被前端感知。

## E2E 測試的成本控制：Playwright 的並行化與選擇性執行

E2E 測試價值最高但成本也最高——執行慢、環境依賴多、容易 flaky。控制成本的關鍵策略是**選擇性執行**：

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 2 : 0,

  // 只在 CI 上跑所有瀏覽器，本地只跑 chromium
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      metadata: { tier: 'smoke' },
    },
    ...(process.env.CI
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],

  // 標註測試層級
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

用 `@tier` 標註把 E2E 測試分層：

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

// 冒煙測試：PR 每次都跑，覆蓋核心路徑
test.describe('Checkout 冒煙測試 @tier:smoke', () => {
  test('完成完整購買流程', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '加入購物車' }).first().click();
    await page.getByRole('link', { name: '購物車' }).click();
    await page.getByRole('button', { name: '結賬' }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await page.getByRole('button', { name: '確認下單' }).click();
    await expect(page.getByText('訂單已創建')).toBeVisible();
  });
});

// 全量回歸：只在 merge 到 main 時跑
test.describe('Checkout 邊緣場景 @tier:full', () => {
  test('庫存不足時阻止下單', async ({ page }) => {
    // 通過 API 模擬庫存爲 0 的狀態
    await page.route('**/api/inventory/*', (route) =>
      route.fulfill({ json: { stock: 0 } }),
    );
    await page.goto('/product/123');
    await expect(page.getByText('暫時缺貨')).toBeVisible();
    await expect(page.getByRole('button', { name: '加入購物車' })).toBeDisabled();
  });
});
```

CI 中按層級觸發：

```yaml
# .github/workflows/test.yml
jobs:
  pr-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 單元 + 集成測試
        run: pnpm test:unit
      - name: E2E 冒煙測試
        run: pnpm test:e2e --grep @tier:smoke

  full-regression:
    if: github.base_ref == 'main'
    runs-on: ubuntu-latest
    steps:
      - name: E2E 全量回歸
        run: pnpm test:e2e
```

## 測試覆蓋率陷阱：不要追求 100%

覆蓋率是底線指標，不是目標。100% 覆蓋率不等於沒有 Bug——一個被 100% 行覆蓋的函數，可能缺少邊界條件測試。更危險的是，爲了湊覆蓋率而寫的測試往往是低價值的。

務實的做法是設定合理的覆蓋率門檻（如行覆蓋 70-80%、分支覆蓋 60-70%），把精力放在高風險區域：金融計算、權限邏輯、狀態轉換。用覆蓋率的變化趨勢比絕對值更有意義——如果某次 PR 導致覆蓋率下降 5%，值得審查是否遺漏了測試。

## 完整的測試分層實踐

一個典型的前端項目測試配置：

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e', '.storybook'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 75,
        branches: 65,
        exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
      },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

```typescript
// tests/setup.ts - 全局測試配置
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// MSW 在所有測試中攔截 API 請求
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

MSW（Mock Service Worker）是前端測試中 API mock 的最佳選擇。它不侵入應用代碼（不需要在 fetch/axios 層注入 mock），而是在 Service Worker 層攔截網絡請求。同一套 mock handler 可以在集成測試和 Storybook 中共用。

## CI 中的測試策略：PR 檢查 vs 全量回歸

CI 測試策略的核心是**分層執行、按需觸發**：

- **PR 提交時**：ESLint + TypeScript 檢查 → 單元 + 集成測試 → E2E 冒煙測試。目標是在 5 分鐘內給出反饋。
- **Merge 到 main 時**：全量 E2E 回歸 + 視覺回歸測試 + 跨瀏覽器測試。可以接受 15-20 分鐘執行時間。
- **定時任務**：每天凌晨跑一次全量回歸，捕獲依賴更新帶來的隱性破壞。

PR 檢查階段如果超過 10 分鐘，開發者就會開始跳過測試或手動 merge。保持 PR 檢查快速是測試策略能落地的前提——寧可減少 E2E 冒煙用例數量，也不能讓 CI 成爲開發效率的瓶頸。

## 小結

前端測試策略不應該盲目套用經典金字塔模型。Testing Trophy 模型更契合前端實際：靜態檢查打底，純函數做單元測試，組件交互做集成測試（主力），關鍵路徑做 E2E。核心原則是測試行爲而非實現、用用戶視角查詢 DOM、按風險分配測試投入、CI 中分層執行控制反饋速度。覆蓋率是參考不是目標——好的測試策略讓你在重構時有信心、在出 Bug 時能快速定位，而不是追求一個完美的百分比數字。
