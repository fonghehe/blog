---
title: "React Testing Best Practices 2025"
date: 2025-01-28 15:22:59
tags:
  - React
readingTime: 3
description: "React 20's Compiler and concurrent features have changed the behavioral patterns of components, so testing strategies need to be updated accordingly. By 2025, R"
wordCount: 180
---

React 20's Compiler and concurrent features have changed the behavioral patterns of components, so testing strategies need to be updated accordingly. By 2025, React testing has converged on a mature set of patterns: Vitest as the test runner, Testing Library for component tests, Playwright for E2E, and MSW for network request interception.

## Vitest Configuration and React 20 Adaptation

```javascript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      // Compiler needs to be enabled in the test environment too
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Concurrent tests, leverage multiple cores
    pool: "threads",
    poolOptions: {
      threads: { maxThreads: 4 },
    },
    // React 20's Suspense requires special handling
    environmentOptions: {
      jsdom: {
        resources: "usable",
      },
    },
  },
});
```

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup(); // React 20 requires explicit cleanup
});

// Mock the async behavior of useTransition
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    // In the test environment, transitions execute synchronously
    useTransition: () => [false, (cb: () => void) => cb()],
  };
});
```

## Component Tests: Behavior First

2025 component tests emphasize testing user behavior, not component implementation. React 20's `useActionState` and `useField` make this philosophy easier to put into practice.

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
      return HttpResponse.json({ token: 'abc', user: { name: '张三' } });
    }
    return HttpResponse.json(
      { error: '邮箱或密码错误' },
      { status: 401 }
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LoginForm', () => {
  it('redirects to home on successful login', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    // Wait for async operation to complete
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ user: { name: '张三' } })
      );
    });
  });

  it('shows error message when form validation fails', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // Type an invalid email only
    await user.type(screen.getByLabelText('邮箱'), 'invalid');
    await user.tab(); // trigger blur event

    expect(await screen.findByText('请输入有效的邮箱')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeDisabled();
  });
});
```

## Testing Strategy for Suspense Components

React 20 components may suspend during rendering, and tests need to handle this behavior:

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
      <Suspense fallback={<div data-testid="loading">加载中...</div>}>
        {ui}
      </Suspense>
    </QueryClientProvider>
  );
}

describe('UserProfile', () => {
  it('shows user info after loading completes', async () => {
    // MSW mock API response
    server.use(
      http.get('/api/users/1', () => {
        return HttpResponse.json({
          id: '1',
          name: '李四',
          bio: '前端工程师',
        });
      })
    );

    renderWithProviders(<UserProfile userId="1" />);

    // First shows loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('李四')).toBeInTheDocument();
    });

    expect(screen.getByText('前端工程师')).toBeInTheDocument();
  });
});
```

## E2E Testing: Playwright Best Practices

```typescript
// e2e/checkout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("购物流程", () => {
  test("添加商品到购物车并结算", async ({ page }) => {
    await page.goto("/products");

    // 选择商品
    await page.getByRole("button", { name: "添加到购物车" }).first().click();

    // 验证购物车图标更新
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // 进入购物车
    await page.getByRole("link", { name: "购物车" }).click();

    // 填写收货地址（使用 useField 的表单）
    await page.getByPlaceholder("收货地址").fill("北京市朝阳区");
    await page.getByPlaceholder("手机号").fill("13800138000");

    // 提交订单
    await page.getByRole("button", { name: "提交订单" }).click();

    // 等待 Server Action 完成
    await expect(page.getByText("订单提交成功")).toBeVisible({
      timeout: 10000,
    });
  });

  test("网络异常时显示错误提示", async ({ page }) => {
    // 模拟网络失败
    await page.route("/api/orders", (route) => route.abort());

    await page.goto("/checkout");
    await page.getByRole("button", { name: "提交订单" }).click();

    await expect(page.getByText("网络异常，请重试")).toBeVisible();
  });
});
```

## Summary

- Vitest has fully replaced Jest; remember to enable React Compiler and Suspense support during configuration
- Component tests are user-behavior-driven; MSW intercepts network requests to avoid backend dependencies
- Suspense components need to be wrapped in a `QueryClientProvider` and a `Suspense` boundary for testing
- Playwright is the first choice for E2E testing; route interception can simulate various network scenarios
- Recommended testing pyramid ratio: 60% unit tests, 30% component tests, 10% E2E tests
