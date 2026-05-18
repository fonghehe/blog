---
title: "React 測試 2025 最佳實踐"
date: 2025-01-28 10:00:00
tags:
  - React
readingTime: 3
description: "React 20 的 Compiler 和併發特性改變了組件的行為模式，測試策略也需要相應調整。2025 年的 React 測試已經形成了一套成熟的範式：Vitest 作為測試運行器，Testing Library 做組件測試，Playwright 負責 E2E，MSW 攔截網絡請求。"
---

React 20 的 Compiler 和併發特性改變了組件的行為模式，測試策略也需要相應調整。2025 年的 React 測試已經形成了一套成熟的範式：Vitest 作為測試運行器，Testing Library 做組件測試，Playwright 負責 E2E，MSW 攔截網絡請求。

## Vitest 配置與 React 20 適配

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // 測試環境也需要啓用 Compiler
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // 併發測試，利用多核
    pool: 'threads',
    poolOptions: {
      threads: { maxThreads: 4 },
    },
    // React 20 的 Suspense 需要特殊處理
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup(); // React 20 需要顯式 cleanup
});

// 模擬 useTransition 的異步行為
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    // 測試環境中 transition 同步執行
    useTransition: () => [false, (cb: () => void) => cb()],
  };
});
```

## 組件測試：行為優先

2025 年的組件測試強調測試用户行為，而不是組件實現。React 20 的 `useActionState` 和 `useField` 讓這個理念更容易落地。

```typescript
// components/LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { describe, it, expect } from 'vitest';
import LoginForm from './LoginForm';

const server = setupServer(
  http.post('/api/login', async ({ request }) => {
    const body = await request.json();
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({ token: 'abc', user: { name: '張三' } });
    }
    return HttpResponse.json(
      { error: '郵箱或密碼錯誤' },
      { status: 401 }
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LoginForm', () => {
  it('登錄成功後跳轉到首頁', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('郵箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密碼'), 'password123');
    await user.click(screen.getByRole('button', { name: '登錄' }));

    // 等待異步操作完成
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ user: { name: '張三' } })
      );
    });
  });

  it('表單驗證失敗時顯示錯誤信息', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // 只輸入不合法的郵箱
    await user.type(screen.getByLabelText('郵箱'), 'invalid');
    await user.tab(); // 觸發 blur 事件

    expect(await screen.findByText('請輸入有效的郵箱')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登錄' })).toBeDisabled();
  });
});
```

## Suspense 組件的測試策略

React 20 的組件可能在渲染時掛起（suspend），測試需要處理這個行為：

```typescript
// components/UserProfile.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, it, expect } from 'vitest';
import UserProfile from './UserProfile';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="loading">加載中...</div>}>
        {ui}
      </Suspense>
    </QueryClientProvider>
  );
}

describe('UserProfile', () => {
  it('加載完成後顯示用户信息', async () => {
    // MSW 模擬 API 響應
    server.use(
      http.get('/api/users/1', () => {
        return HttpResponse.json({
          id: '1',
          name: '李四',
          bio: '前端工程師',
        });
      })
    );

    renderWithProviders(<UserProfile userId="1" />);

    // 首先顯示 loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // 等待數據加載完成
    await waitFor(() => {
      expect(screen.getByText('李四')).toBeInTheDocument();
    });

    expect(screen.getByText('前端工程師')).toBeInTheDocument();
  });
});
```

## E2E 測試：Playwright 最佳實踐

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('購物流程', () => {
  test('添加商品到購物車並結算', async ({ page }) => {
    await page.goto('/products');

    // 選擇商品
    await page.getByRole('button', { name: '添加到購物車' }).first().click();

    // 驗證購物車圖標更新
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    // 進入購物車
    await page.getByRole('link', { name: '購物車' }).click();

    // 填寫收貨地址（使用 useField 的表單）
    await page.getByPlaceholder('收貨地址').fill('北京市朝陽區');
    await page.getByPlaceholder('手機號').fill('13800138000');

    // 提交訂單
    await page.getByRole('button', { name: '提交訂單' }).click();

    // 等待 Server Action 完成
    await expect(page.getByText('訂單提交成功')).toBeVisible({
      timeout: 10000,
    });
  });

  test('網絡異常時顯示錯誤提示', async ({ page }) => {
    // 模擬網絡失敗
    await page.route('/api/orders', (route) => route.abort());

    await page.goto('/checkout');
    await page.getByRole('button', { name: '提交訂單' }).click();

    await expect(page.getByText('網絡異常，請重試')).toBeVisible();
  });
});
```

## 小結

- Vitest 已全面取代 Jest，配置時注意啓用 React Compiler 和 Suspense 支持
- 組件測試以用户行為為導向，MSW 攔截網絡請求，避免測試依賴後端
- Suspense 組件需要包裹在 QueryClientProvider 和 Suspense 邊界中測試
- Playwright 是 E2E 測試的首選，配合 route 攔截可以模擬各種網絡場景
- 測試金字塔比例建議：單元測試 60%、組件測試 30%、E2E 測試 10%
