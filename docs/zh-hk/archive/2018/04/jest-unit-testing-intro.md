---
title: "Jest 單元測試入門"
date: 2018-04-02 10:27:58
tags:
  - 測試
readingTime: 2
description: "前端測試一直是個被忽視的領域，但隨着項目規模增長，沒有測試的代碼越來越難以維護。Jest 是目前最流行的 JavaScript 測試框架，配置簡單，功能全面。"
---

前端測試一直是個被忽視的領域，但隨着項目規模增長，沒有測試的代碼越來越難以維護。Jest 是目前最流行的 JavaScript 測試框架，配置簡單，功能全面。

## 安裝和配置

```bash
npm install --save-dev jest babel-jest @babel/preset-env

# Vue 項目還需要
npm install --save-dev @vue/test-utils vue-jest
```

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ["js", "vue", "json"],
  transform: {
    "^.+\\.vue$": "vue-jest",
    "^.+\\.js$": "babel-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // 路徑別名
  },
  testMatch: ["**/__tests__/**/*.spec.js"],
};
```

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## 基礎語法

```javascript
// __tests__/utils.spec.js

// describe 分組測試
describe("formatPrice", () => {
  // it/test 單個測試用例
  it("整數金額正確格式化", () => {
    expect(formatPrice(1000)).toBe("1,000.00");
  });

  it("小數金額正確格式化", () => {
    expect(formatPrice(1234.5)).toBe("1,234.50");
  });

  it("零值處理", () => {
    expect(formatPrice(0)).toBe("0.00");
  });

  it("負數處理", () => {
    expect(formatPrice(-100)).toBe("-100.00");
  });
});
```

## 常用斷言

```javascript
// 相等
expect(1 + 1).toBe(2); // 嚴格相等 ===
expect({ a: 1 }).toEqual({ a: 1 }); // 深度相等

// 真假
expect(true).toBeTruthy();
expect(null).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();

// 數字
expect(5).toBeGreaterThan(3);
expect(5).toBeLessThanOrEqual(5);

// 字符串
expect("hello world").toContain("world");
expect("hello").toMatch(/^hel/);

// 數組
expect([1, 2, 3]).toContain(2);
expect([1, 2, 3]).toHaveLength(3);

// 對象
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); // 包含子集即可

// 異常
expect(() => {
  throw new Error("oops");
}).toThrow("oops");
```

## 測試異步代碼

```javascript
// async/await 方式（推薦）
it("fetchUser 返回正確數據", async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe("Alice");
});

// Promise 方式
it("fetchUser 返回正確數據", () => {
  return fetchUser(1).then((user) => {
    expect(user.name).toBe("Alice");
  });
});
```

## Mock 函數

```javascript
// jest.fn() 創建 mock 函數
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // 設置返回值
mockFn.mockResolvedValue({ id: 1, name: "Alice" }); // 設置 Promise 返回值

// 調用後驗證
mockFn("arg1", "arg2");
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(1);
```

## Mock 模塊

```javascript
// 模擬 axios 請求
jest.mock("axios");
import axios from "axios";

it("調用 API 獲取用户數據", async () => {
  axios.get.mockResolvedValue({ data: { id: 1, name: "Alice" } });

  const user = await getUser(1);

  expect(axios.get).toHaveBeenCalledWith("/api/users/1");
  expect(user.name).toBe("Alice");
});
```

## Vue 組件測試

```javascript
// __tests__/Button.spec.js
import { mount } from "@vue/test-utils";
import Button from "@/components/Button.vue";

describe("Button 組件", () => {
  it("渲染默認 slot 內容", () => {
    const wrapper = mount(Button, {
      slots: { default: "點擊我" },
    });
    expect(wrapper.text()).toContain("點擊我");
  });

  it("點擊觸發 click 事件", async () => {
    const wrapper = mount(Button);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("disabled 狀態不觸發事件", async () => {
    const wrapper = mount(Button, {
      propsData: { disabled: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("loading 時顯示加載狀態", () => {
    const wrapper = mount(Button, {
      propsData: { loading: true },
    });
    expect(wrapper.find(".loading-icon").exists()).toBe(true);
  });
});
```

## 測試覆蓋率

```bash
npm run test:coverage
```

會生成報告，關注幾個指標：

- **Statements**：語句覆蓋率
- **Branches**：分支覆蓋率（if/else 都走到了嗎）
- **Functions**：函數覆蓋率
- **Lines**：行覆蓋率

不要追求 100%，工具函數、核心業務邏輯重點覆蓋，UI 展示類可以少測。

## 小結

- 先從純函數開始寫測試，門檻最低
- `expect().toBe()` 基礎，`toEqual()` 用於對象
- 異步測試用 async/await
- 組件測試用 `@vue/test-utils`，測交互行為
- 有了測試，重構代碼更有底氣
