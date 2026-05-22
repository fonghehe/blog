---
title: "前端测试策略：实用而不是完美"
date: 2025-09-08 15:22:59
tags:
  - 前端
readingTime: 2
description: "测试是大家都觉得重要，但实际做得稀烂的事情。说说我这几年对前端测试策略的认知演变。"
wordCount: 313
---

测试是大家都觉得重要，但实际做得稀烂的事情。说说我这几年对前端测试策略的认知演变。

## 测试金字塔 → 测试奖杯

经典的测试金字塔说：单元测试最多，集成测试中等，E2E 最少。

但 Kent C. Dodds 提出的测试奖杯（Testing Trophy）更适合前端：

```
            /\
           /E2E\        少（关键流程）
          /
------\
         /Integration\  中（功能模块）
        /------------\
       /  Unit Tests  \  适量（纯函数、工具函数）
      /----------------\
     /   Static Types   \  最多（TypeScript）
    /--------------------\
```

**最重要的是集成测试**，因为它最能反映用户实际体验，而又比 E2E 快。

## 工具选择（2025 年）

```
单元/集成测试：Vitest（快、ESM 原生、Vite 生态）
组件测试：@testing-library/react or @testing-library/vue
E2E：Playwright（比 Cypress 更现代）
覆盖率：@vitest/coverage-v8
```

## 测试什么，不测什么

```
✅ 要测：
  - 业务逻辑（用户能不能完成一个流程）
  - 边界条件（空数据、错误状态）
  - 纯函数和工具函数
  - API 集成（MSW mock）

❌ 不用测：
  - 第三方库的行为
  - 实现细节（内部状态、私有方法）
  - 样式（除非是视觉回归测试）
  - 每一个简单 getter/setter
```

## 实际的测试例子

```tsx
// 测试用户流程，而不是实现细节
import { render, screen, userEvent } from "@testing-library/react";
import { AddToCart } from "./AddToCart";

describe("AddToCart", () => {
  it("用户点击加入购物车，数量增加并显示成功提示", async () => {
    const user = userEvent.setup();
    const mockAddToCart = vi.fn().mockResolvedValue({ success: true });

    render(<AddToCart productId="123" onAddToCart={mockAddToCart} />);

    // 模拟用户操作
    await user.click(screen.getByRole("button", { name: /加入购物车/ }));

    // 验证结果（而不是实现细节）
    expect(mockAddToCart).toHaveBeenCalledWith("123", 1);
    expect(await screen.findByText("已加入购物车")).toBeInTheDocument();
  });

  it("库存不足时，按钮禁用", () => {
    render(<AddToCart productId="123" inStock={false} />);

    const button = screen.getByRole("button", { name: /加入购物车/ });
    expect(button).toBeDisabled();
  });
});
```

```typescript
// MSW：mock API 请求
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/products/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "测试商品",
      price: 99,
      inStock: true,
    });
  }),

  http.post("/api/cart", () => {
    return HttpResponse.json({ success: true, cartCount: 1 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Playwright E2E

```typescript
// tests/checkout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("购物流程", () => {
  test("用户可以完成完整的购买流程", async ({ page }) => {
    await page.goto("/products/123");

    await expect(page.getByRole("heading")).toContainText("商品名称");

    await page.getByRole("button", { name: "加入购物车" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/cart");
    await page.getByRole("button", { name: "去结算" }).click();

    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="address"]', "测试地址");

    await page.getByRole("button", { name: "提交订单" }).click();
    await expect(page.getByText("订单创建成功")).toBeVisible();
  });
});
```

## CI 集成

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    pnpm test:unit --coverage
    pnpm test:e2e

- name: Check coverage threshold
  run: |
    # 覆盖率不达标 → CI 失败
    pnpm test:coverage --reporter=json
    node scripts/check-coverage.js 70  # 70% 阈值
```

## 测试文化

技术不是最难的，难的是让团队把测试当成日常工作：

- **测试是代码的一部分，不是附加工作**
- Code Review 时检查测试
- 修 bug 之前先写失败的测试，再修 bug
- 不要追求 100% 覆盖率，追求有意义的测试

## 小结

- 测试奖杯：集成测试 > 单元测试 > E2E
- 测什么：用户流程、业务逻辑、边界条件
- 不测什么：实现细节、第三方库、简单样式
- 工具：Vitest + @testing-library + MSW + Playwright
- 覆盖率是手段，不是目标；70% 有意义的覆盖率好过 95% 的数字
