---
title: "React 测试 2025 最佳实践"
date: 2025-01-28 15:22:59
tags:
  - React
readingTime: 3
description: "React 20 的 Compiler 和并发特性改变了组件的行为模式，测试策略也需要相应调整。2025 年的 React 测试已经形成了一套成熟的范式：Vitest 作为测试运行器，Testing Library 做组件测试，Playwright 负责 E2E，MSW 拦截网络请求。"
wordCount: 283
---

React 20 的 Compiler 和并发特性改变了组件的行为模式，测试策略也需要相应调整。2025 年的 React 测试已经形成了一套成熟的范式：Vitest 作为测试运行器，Testing Library 做组件测试，Playwright 负责 E2E，MSW 拦截网络请求。

## Vitest 配置与 React 20 适配

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // 测试环境也需要启用 Compiler
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // 并发测试，利用多核
    pool: 'threads',
    poolOptions: {
      threads: { maxThreads: 4 },
    },
    // React 20 的 Suspense 需要特殊处理
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
  cleanup(); // React 20 需要显式 cleanup
});

// 模拟 useTransition 的异步行为
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    // 测试环境中 transition 同步执行
    useTransition: () => [false, (cb: () => void) => cb()],
  };
});
```

## 组件测试：行为优先

2025 年的组件测试强调测试用户行为，而不是组件实现。React 20 的 `useActionState` 和 `useField` 让这个理念更容易落地。

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
  it('登录成功后跳转到首页', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    // 等待异步操作完成
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ user: { name: '张三' } })
      );
    });
  });

  it('表单验证失败时显示错误信息', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // 只输入不合法的邮箱
    await user.type(screen.getByLabelText('邮箱'), 'invalid');
    await user.tab(); // 触发 blur 事件

    expect(await screen.findByText('请输入有效的邮箱')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeDisabled();
  });
});
```

## Suspense 组件的测试策略

React 20 的组件可能在渲染时挂起（suspend），测试需要处理这个行为：

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
  it('加载完成后显示用户信息', async () => {
    // MSW 模拟 API 响应
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

    // 首先显示 loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText('李四')).toBeInTheDocument();
    });

    expect(screen.getByText('前端工程师')).toBeInTheDocument();
  });
});
```

## E2E 测试：Playwright 最佳实践

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('购物流程', () => {
  test('添加商品到购物车并结算', async ({ page }) => {
    await page.goto('/products');

    // 选择商品
    await page.getByRole('button', { name: '添加到购物车' }).first().click();

    // 验证购物车图标更新
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    // 进入购物车
    await page.getByRole('link', { name: '购物车' }).click();

    // 填写收货地址（使用 useField 的表单）
    await page.getByPlaceholder('收货地址').fill('北京市朝阳区');
    await page.getByPlaceholder('手机号').fill('13800138000');

    // 提交订单
    await page.getByRole('button', { name: '提交订单' }).click();

    // 等待 Server Action 完成
    await expect(page.getByText('订单提交成功')).toBeVisible({
      timeout: 10000,
    });
  });

  test('网络异常时显示错误提示', async ({ page }) => {
    // 模拟网络失败
    await page.route('/api/orders', (route) => route.abort());

    await page.goto('/checkout');
    await page.getByRole('button', { name: '提交订单' }).click();

    await expect(page.getByText('网络异常，请重试')).toBeVisible();
  });
});
```

## 小结

- Vitest 已全面取代 Jest，配置时注意启用 React Compiler 和 Suspense 支持
- 组件测试以用户行为为导向，MSW 拦截网络请求，避免测试依赖后端
- Suspense 组件需要包裹在 QueryClientProvider 和 Suspense 边界中测试
- Playwright 是 E2E 测试的首选，配合 route 拦截可以模拟各种网络场景
- 测试金字塔比例建议：单元测试 60%、组件测试 30%、E2E 测试 10%
