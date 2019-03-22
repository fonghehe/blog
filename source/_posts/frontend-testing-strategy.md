---
title: "前端测试策略：单元测试到 E2E 测试"
date: 2019-03-22 09:33:00
tags:
  - 测试
---

一直知道测试重要，但项目里真正写测试的很少。这次认真研究了一下，整理出一套实用的前端测试策略。

## 测试金字塔

```
         /\
        /E2E\        少量：端到端测试（Cypress）
       /------\
      /集成测试\      中量：组件集成测试
     /----------\
    / 单元测试  \     大量：纯函数、工具函数测试
   /____________\
```

不是所有代码都要测，测试成本和价值要平衡。

## 单元测试：Jest

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
  if (discount < 0 || discount > 1) throw new Error("折扣必须在 0-1 之间");
  return Math.round(original * discount * 100) / 100;
}
```

```javascript
// utils/price.test.js
import { formatPrice, calculateDiscount } from "./price";

describe("formatPrice", () => {
  it("格式化人民币价格", () => {
    expect(formatPrice(1234.5)).toBe("¥1,234.50");
  });

  it("格式化美元价格", () => {
    expect(formatPrice(99.99, "USD")).toBe("US$99.99");
  });
});

describe("calculateDiscount", () => {
  it("计算 8 折价格", () => {
    expect(calculateDiscount(100, 0.8)).toBe(80);
  });

  it("折扣超出范围时抛出错误", () => {
    expect(() => calculateDiscount(100, 1.5)).toThrow("折扣必须在 0-1 之间");
    expect(() => calculateDiscount(100, -0.1)).toThrow();
  });

  it("处理浮点数精度", () => {
    expect(calculateDiscount(99.99, 0.7)).toBe(69.99);
  });
});
```

## Vue 组件测试：Vue Test Utils

```bash
npm i -D @vue/test-utils vue-jest
```

```javascript
// components/BaseButton.test.js
import { shallowMount } from "@vue/test-utils";
import BaseButton from "./BaseButton.vue";

describe("BaseButton", () => {
  it("渲染 slot 内容", () => {
    const wrapper = shallowMount(BaseButton, {
      slots: { default: "点击我" },
    });
    expect(wrapper.text()).toBe("点击我");
  });

  it("点击时触发 click 事件", async () => {
    const wrapper = shallowMount(BaseButton);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("disabled 时不触发事件", async () => {
    const wrapper = shallowMount(BaseButton, {
      propsData: { disabled: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("loading 状态显示加载图标", () => {
    const wrapper = shallowMount(BaseButton, {
      propsData: { loading: true },
    });
    expect(wrapper.find(".loading-icon").exists()).toBe(true);
  });
});
```

## React 组件测试：Testing Library

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

test("输入后发起搜索", async () => {
  search.mockResolvedValue([{ id: 1, name: "结果1" }]);

  render(<SearchBox />);

  const input = screen.getByPlaceholderText("搜索...");
  fireEvent.change(input, { target: { value: "test" } });

  // 等待异步操作
  await waitFor(() => {
    expect(screen.getByText("结果1")).toBeInTheDocument();
  });

  expect(search).toHaveBeenCalledWith("test");
});
```

## E2E 测试：Cypress

```bash
npm i -D cypress
```

```javascript
// cypress/integration/login.spec.js
describe("登录流程", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("正确的账号密码登录成功", () => {
    cy.get('[data-testid="email"]').type("user@example.com");
    cy.get('[data-testid="password"]').type("password123");
    cy.get('[data-testid="submit"]').click();

    cy.url().should("include", "/dashboard");
    cy.get('[data-testid="user-name"]').should("contain", "用户名");
  });

  it("错误密码显示错误提示", () => {
    cy.get('[data-testid="email"]').type("user@example.com");
    cy.get('[data-testid="password"]').type("wrongpassword");
    cy.get('[data-testid="submit"]').click();

    cy.get('[data-testid="error"]').should("be.visible");
    cy.url().should("include", "/login");
  });

  // 用 API 登录（比 UI 快，用于设置测试前置条件）
  it("登录后能访问受保护页面", () => {
    cy.request("POST", "/api/login", {
      email: "user@example.com",
      password: "password123",
    }).then(({ body }) => {
      localStorage.setItem("token", body.token);
    });

    cy.visit("/protected-page");
    cy.contains("受保护内容").should("be.visible");
  });
});
```

## 测试覆盖率配置

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

## 小结

- **单元测试**：纯函数、工具函数必测，ROI 最高
- **组件测试**：测行为不测实现（用 Testing Library 而不是测 state）
- **E2E 测试**：测关键用户流程（登录、支付、核心功能）
- 测试覆盖率不是目的，有意义的测试才是
- `data-testid` 属性专门给测试用，不依赖 class 或文本（更稳定）
