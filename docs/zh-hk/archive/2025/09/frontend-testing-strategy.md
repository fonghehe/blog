---
title: "前端測試策略：實用而不是完美"
date: 2025-09-08 15:22:59
tags:
  - 前端
readingTime: 2
description: "測試是大家都覺得重要，但實際做得稀爛的事情。説説我這幾年對前端測試策略的認知演變。"
wordCount: 313
---

測試是大家都覺得重要，但實際做得稀爛的事情。説説我這幾年對前端測試策略的認知演變。

## 測試金字塔 → 測試獎盃

經典的測試金字塔説：單元測試最多，集成測試中等，E2E 最少。

但 Kent C. Dodds 提出的測試獎盃（Testing Trophy）更適合前端：

```
            /\
           /E2E\        少（關鍵流程）
          /
------\
         /Integration\  中（功能模塊）
        /------------\
       /  Unit Tests  \  適量（純函數、工具函數）
      /----------------\
     /   Static Types   \  最多（TypeScript）
    /--------------------\
```

**最重要的是集成測試**，因為它最能反映用户實際體驗，而又比 E2E 快。

## 工具選擇（2025 年）

```
單元/集成測試：Vitest（快、ESM 原生、Vite 生態）
組件測試：@testing-library/react or @testing-library/vue
E2E：Playwright（比 Cypress 更現代）
覆蓋率：@vitest/coverage-v8
```

## 測試什麼，不測什麼

```
✅ 要測：
  - 業務邏輯（用户能不能完成一個流程）
  - 邊界條件（空數據、錯誤狀態）
  - 純函數和工具函數
  - API 集成（MSW mock）

❌ 不用測：
  - 第三方庫的行為
  - 實現細節（內部狀態、私有方法）
  - 樣式（除非是視覺迴歸測試）
  - 每一個簡單 getter/setter
```

## 實際的測試例子

```tsx
// 測試用户流程，而不是實現細節
import { render, screen, userEvent } from "@testing-library/react";
import { AddToCart } from "./AddToCart";

describe("AddToCart", () => {
  it("用户點擊加入購物車，數量增加並顯示成功提示", async () => {
    const user = userEvent.setup();
    const mockAddToCart = vi.fn().mockResolvedValue({ success: true });

    render(<AddToCart productId="123" onAddToCart={mockAddToCart} />);

    // 模擬用户操作
    await user.click(screen.getByRole("button", { name: /加入購物車/ }));

    // 驗證結果（而不是實現細節）
    expect(mockAddToCart).toHaveBeenCalledWith("123", 1);
    expect(await screen.findByText("已加入購物車")).toBeInTheDocument();
  });

  it("庫存不足時，按鈕禁用", () => {
    render(<AddToCart productId="123" inStock={false} />);

    const button = screen.getByRole("button", { name: /加入購物車/ });
    expect(button).toBeDisabled();
  });
});
```

```typescript
// MSW：mock API 請求
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/products/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "測試商品",
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

test.describe("購物流程", () => {
  test("用户可以完成完整的購買流程", async ({ page }) => {
    await page.goto("/products/123");

    await expect(page.getByRole("heading")).toContainText("商品名稱");

    await page.getByRole("button", { name: "加入購物車" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/cart");
    await page.getByRole("button", { name: "去結算" }).click();

    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="address"]', "測試地址");

    await page.getByRole("button", { name: "提交訂單" }).click();
    await expect(page.getByText("訂單創建成功")).toBeVisible();
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
    # 覆蓋率不達標 → CI 失敗
    pnpm test:coverage --reporter=json
    node scripts/check-coverage.js 70  # 70% 閾值
```

## 測試文化

技術不是最難的，難的是讓團隊把測試當成日常工作：

- **測試是代碼的一部分，不是附加工作**
- Code Review 時檢查測試
- 修 bug 之前先寫失敗的測試，再修 bug
- 不要追求 100% 覆蓋率，追求有意義的測試

## 小結

- 測試獎盃：集成測試 > 單元測試 > E2E
- 測什麼：用户流程、業務邏輯、邊界條件
- 不測什麼：實現細節、第三方庫、簡單樣式
- 工具：Vitest + @testing-library + MSW + Playwright
- 覆蓋率是手段，不是目標；70% 有意義的覆蓋率好過 95% 的數字
