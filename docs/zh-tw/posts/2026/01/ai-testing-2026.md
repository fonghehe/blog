---
title: "AI 測試 2026 全自動化"
date: 2026-01-14 10:00:00
tags:
  - 工程化
readingTime: 4
description: "寫測試用例是前端開發中最枯燥但最重要的工作之一。2026 年，AI 已經能自動生成單元測試、整合測試、甚至端到端測試。但\"自動生成\"不等於\"自動生成好測試\"——垃圾測試比沒有測試更危險，因為它給你虛假的安全感。"
---

寫測試用例是前端開發中最枯燥但最重要的工作之一。2026 年，AI 已經能自動生成單元測試、整合測試、甚至端到端測試。但"自動生成"不等於"自動生成好測試"——垃圾測試比沒有測試更危險，因為它給你虛假的安全感。

## 測試生成的正確姿勢

直接讓 AI "給這個元件寫測試"產出的程式碼通常是垃圾。好的測試生成需要你提供上下文：使用者的實際使用路徑、邊界條件、以及"這個元件最容易出 bug 的地方"。

```tsx
// 被測元件 —— 一個典型的表單元件
interface AddressFormProps {
  onSubmit: (data: AddressData) => Promise<void>;
  initialValues?: Partial<AddressData>;
  disabled?: boolean;
}

export function AddressForm({ onSubmit, initialValues, disabled }: AddressFormProps) {
  const [province, setProvince] = useState(initialValues?.province ?? '');
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [district, setDistrict] = useState(initialValues?.district ?? '');
  const [detail, setDetail] = useState(initialValues?.detail ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ... 表單邏輯
}

// AI 生成測試時需要的 prompt 注入：
// "這個元件的核心風險點：
//  1. 省市區三級聯動：選省後城市列表要清空重選
//  2. 提交時的併發控制：防重複提交
//  3. initialValues 變化時表單要重新初始化
//  4. disabled 狀態下所有輸入和按鈕都不可用"
```

```tsx
// AI 生成的測試 —— 基於風險點的針對性測試
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressForm } from './address-form';

describe('AddressForm', () => {
  it('切換省份時應清空城市和區縣選擇', async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('省份'), '浙江省');
    await user.selectOptions(screen.getByLabelText('城市'), '杭州市');

    // 切換省份
    await user.selectOptions(screen.getByLabelText('省份'), '江蘇省');

    expect(screen.getByLabelText('城市')).toHaveValue('');
    expect(screen.getByLabelText('區縣')).toHaveValue('');
  });

  it('提交中應防止重複提交', async () => {
    const user = userEvent.setup();
    const slowSubmit = vi.fn(() => new Promise((r) => setTimeout(r, 2000)));
    render(<AddressForm onSubmit={slowSubmit} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: '提交' }));

    // 提交按鈕應立即停用
    expect(screen.getByRole('button', { name: '提交中...' })).toBeDisabled();

    // 再次點選不應觸發第二次提交
    await user.click(screen.getByRole('button', { name: '提交中...' }));
    expect(slowSubmit).toHaveBeenCalledTimes(1);
  });

  it('initialValues 變化應重新初始化表單', async () => {
    const { rerender } = render(
      <AddressForm onSubmit={vi.fn()} initialValues={{ province: '浙江省' }} />
    );
    expect(screen.getByLabelText('省份')).toHaveValue('浙江省');

    rerender(
      <AddressForm onSubmit={vi.fn()} initialValues={{ province: '廣東省' }} />
    );
    expect(screen.getByLabelText('省份')).toHaveValue('廣東省');
  });
});
```

## E2E 測試的 AI 生成策略

端到端測試是最難自動生成的。因為 AI 需要理解使用者旅程、等待非同步操作、處理動態內容。關鍵是在 prompt 中描述清楚使用者操作序列，而不是讓 AI 自由發揮。

```typescript
// e2e-test-prompt.ts —— 給 AI 的 E2E 測試 prompt 模板
const e2eTestPrompt = `
為以下使用者旅程生成 Playwright E2E 測試：

旅程：使用者註冊 -> 瀏覽商品 -> 加入購物車 -> 結算

關鍵斷言點：
1. 註冊成功後跳轉到首頁，右上角顯示使用者名稱
2. 商品列表載入完成後顯示至少 12 個商品卡片
3. 加入購物車後底部購物車角標數字 +1
4. 結算頁面顯示的商品數量和價格與購物車一致

技術細節：
- API 走 mock（msw），不要依賴後端
- 使用 page.waitForResponse 等待資料載入
- 使用 data-testid 定位元素
`;

// AI 生成的 E2E 測試
import { test, expect } from '@playwright/test';

test('完整購物流程', async ({ page }) => {
  // 1. 註冊
  await page.goto('/register');
  await page.getByTestId('email-input').fill('test@example.com');
  await page.getByTestId('password-input').fill('SecurePass123!');
  await page.getByTestId('name-input').fill('測試使用者');

  const registerResponse = page.waitForResponse('/api/auth/register');
  await page.getByTestId('register-btn').click();
  await registerResponse;

  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('user-name')).toHaveText('測試使用者');

  // 2. 瀏覽商品
  await page.goto('/products');
  await page.waitForResponse('/api/products*');

  const productCards = page.getByTestId('product-card');
  await expect(productCards).toHaveCount(12);

  // 3. 加入購物車
  const cartBadge = page.getByTestId('cart-badge');
  const initialCount = parseInt((await cartBadge.textContent()) ?? '0');

  await productCards.first().getByTestId('add-to-cart').click();
  await expect(cartBadge).toHaveText(String(initialCount + 1));

  // 4. 結算
  await page.getByTestId('cart-icon').click();
  await page.getByTestId('checkout-btn').click();

  const checkoutItems = page.getByTestId('checkout-item');
  await expect(checkoutItems).toHaveCount(1);
});
```

## 測試覆蓋率的 AI 分析

覆蓋率數字本身沒有太大意義。AI 的價值是分析哪些未覆蓋的程式碼路徑是真正有風險的，幫你排優先順序。

```typescript
// coverage-analysis.ts
interface CoverageGap {
  file: string;
  line: number;
  branch: string;
  riskScore: number;    // AI 評估的風險分數 0-100
  reason: string;
  suggestedTest: string;
}

// AI 分析後的輸出示例
const gaps: CoverageGap[] = [
  {
    file: 'src/utils/payment.ts',
    line: 45,
    branch: 'payment-retry-on-timeout',
    riskScore: 95,
    reason: '支付重試邏輯，未測試超時場景',
    suggestedTest: '應測試 3 次重試後仍失敗的降級處理',
  },
  {
    file: 'src/components/modal.tsx',
    line: 22,
    branch: 'escape-key-handler',
    riskScore: 15,
    reason: 'ESC 關閉彈窗，標準行為',
    suggestedTest: '可選，優先順序低',
  },
  {
    file: 'src/hooks/useWebSocket.ts',
    line: 78,
    branch: 'reconnect-after-network-change',
    riskScore: 88,
    reason: '網路切換時的重連邏輯，涉及定時器和狀態清理',
    suggestedTest: '應模擬網路斷開->恢復，驗證重連和訊息補發',
  },
];

// 按風險分數排序，只關注高風險的未覆蓋路徑
const highRiskGaps = gaps.filter((g) => g.riskScore >= 70);
```

## 測試維護的自動化

測試最大的成本不是寫，而是維護。AI 可以監控測試失敗、自動修復因程式碼變更導致的測試斷裂、甚至標記過時的測試。

```typescript
// test-maintenance.ts
import { execSync } from 'child_process';

async function autoFixTests() {
  // 執行測試，收集失敗資訊
  const output = execSync('npx vitest run --reporter=json', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const results = JSON.parse(output);
  const failures = results.testResults.filter(
    (t: any) => t.status === 'failed'
  );

  for (const failure of failures) {
    // 將失敗資訊和 diff 一起傳給 AI
    const diff = execSync('git diff HEAD~1', { encoding: 'utf-8' });
    const fixPrompt = `
測試檔案 ${failure.name} 失敗。
失敗資訊：${failure.message}
最近的程式碼變更：${diff}
請分析失敗原因並修復測試。如果是程式碼變更導致的預期行為變化，
更新測試斷言；如果是迴歸 bug，標記為需要人工處理。
    `;

    // 呼叫 AI 修復
    // AI 會區分"測試需要更新"和"程式碼有 bug"兩種情況
  }
}
```

## 小結

- AI 生成測試需要你提供風險點上下文，盲目的"幫我寫測試"產出的是垃圾
- 單元測試 AI 已經做得很好，E2E 測試需要更精確的 prompt 引導
- 覆蓋率數字不如 AI 的風險分析有意義，優先覆蓋高風險路徑
- 測試維護成本遠高於編寫成本，AI 自動修復斷裂測試是真正的價值點
- 好的測試策略：AI 負責廣度（覆蓋率），人負責深度（核心路徑的正確性）
