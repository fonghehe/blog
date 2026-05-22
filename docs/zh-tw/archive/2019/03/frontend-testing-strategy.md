---
title: "前端測試策略：單元測試到 E2E 測試"
date: 2019-03-22 09:33:00
tags:
  - 測試
readingTime: 2
description: "一直知道測試重要，但專案裡真正寫測試的很少。這次認真研究了一下，整理出一套實用的前端測試策略。"
wordCount: 198
---

一直知道測試重要，但專案裡真正寫測試的很少。這次認真研究了一下，整理出一套實用的前端測試策略。

## 測試金字塔

```
         /\
        /E2E\        少量：端到端測試（Cypress）
       /
------\
      /整合測試\      中量：元件整合測試
     /----------\
    / 單元測試  \     大量：純函式、工具函式測試
   /____________\
```

不是所有程式碼都要測，測試成本和價值要平衡。

## 單元測試：Jest

```bash
npm i -D jest @types/jest babel-jest
```

```javascript
// utils/price.js
export function formatPrice(price, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
  }).format(price);
}

export function calculateDiscount(original, discount) {
  if (discount < 0 || discount > 1) throw new Error("折扣必須在 0-1 之間");
  return Math.round(original * discount * 100) / 100;
}
```

```javascript
// utils/price.test.js
import { formatPrice, calculateDiscount } from "./price";

describe("formatPrice", () => {
  it("格式化人民幣價格", () => {
    expect(formatPrice(1234.5)).toBe("¥1,234.50");
  });

  it("格式化美元價格", () => {
    expect(formatPrice(99.99, "USD")).toBe("US$99.99");
  });
});

describe("calculateDiscount", () => {
  it("計算 8 折價格", () => {
    expect(calculateDiscount(100, 0.8)).toBe(80);
  });

  it("折扣超出範圍時丟擲錯誤", () => {
    expect(() => calculateDiscount(100, 1.5)).toThrow("折扣必須在 0-1 之間");
    expect(() => calculateDiscount(100, -0.1)).toThrow();
  });

  it("處理浮點數精度", () => {
    expect(calculateDiscount(99.99, 0.7)).toBe(69.99);
  });
});
```

## Vue 元件測試：Vue Test Utils

```bash
npm i -D @vue/test-utils vue-jest
```

```javascript
// components/BaseButton.test.js
import { shallowMount } from "@vue/test-utils";
import BaseButton from "./BaseButton.vue";

describe("BaseButton", () => {
  it("渲染 slot 內容", () => {
    const wrapper = shallowMount(BaseButton, {
      slots: { default: "點選我" },
    });
    expect(wrapper.text()).toBe("點選我");
  });

  it("點選時觸發 click 事件", async () => {
    const wrapper = shallowMount(BaseButton);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("disabled 時不觸發事件", async () => {
    const wrapper = shallowMount(BaseButton, {
      propsData: { disabled: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("loading 狀態顯示載入圖示", () => {
    const wrapper = shallowMount(BaseButton, {
      propsData: { loading: true },
    });
    expect(wrapper.find(".loading-icon").exists()).toBe(true);
  });
});
```

## React 元件測試：Testing Library

```bash
npm i -D @testing-library/react @testing-library/jest-dom
```

```javascript
// components/SearchBox.test.jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchBox from "./SearchBox";

// mock API
jest.mock("../api", () => ({
  search: jest.fn(),
}));
import { search } from "../api";

test("輸入後發起搜尋", async () => {
  search.mockResolvedValue([{ id: 1, name: "結果1" }]);

  render(<SearchBox />);

  const input = screen.getByPlaceholderText("搜尋...");
  fireEvent.change(input, { target: { value: "test" } });

  // 等待非同步操作
  await waitFor(() => {
    expect(screen.getByText("結果1")).toBeInTheDocument();
  });

  expect(search).toHaveBeenCalledWith("test");
});
```

## E2E 測試：Cypress

```bash
npm i -D cypress
```

```javascript
// cypress/integration/login.spec.js
describe("登入流程", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("正確的賬號密碼登入成功", () => {
    cy.get('[data-testid="email"]').type("user@example.com");
    cy.get('[data-testid="password"]').type("password123");
    cy.get('[data-testid="submit"]').click();

    cy.url().should("include", "/dashboard");
    cy.get('[data-testid="user-name"]').should("contain", "使用者名稱");
  });

  it("錯誤密碼顯示錯誤提示", () => {
    cy.get('[data-testid="email"]').type("user@example.com");
    cy.get('[data-testid="password"]').type("wrongpassword");
    cy.get('[data-testid="submit"]').click();

    cy.get('[data-testid="error"]').should("be.visible");
    cy.url().should("include", "/login");
  });

  // 用 API 登入（比 UI 快，用於設定測試前置條件）
  it("登入後能訪問受保護頁面", () => {
    cy.request("POST", "/api/login", {
      email: "user@example.com",
      password: "password123",
    }).then(({ body }) => {
      localStorage.setItem("token", body.token);
    });

    cy.visit("/protected-page");
    cy.contains("受保護內容").should("be.visible");
  });
});
```

## 測試覆蓋率設定

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:e2e": "cypress run"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{js,jsx,vue}",
      "!src/main.js",
      "!src/**/*.stories.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

## 小結

- **單元測試**：純函式、工具函式必測，ROI 最高
- **元件測試**：測行為不測實現（用 Testing Library 而不是測 state）
- **E2E 測試**：測關鍵使用者流程（登入、支付、核心功能）
- 測試覆蓋率不是目的，有意義的測試才是
- `data-testid` 屬性專門給測試用，不依賴 class 或文本（更穩定）
