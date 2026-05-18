---
title: "Jest 单元测试入门"
date: 2018-04-02 10:27:58
tags:
  - 测试
readingTime: 2
description: "前端测试一直是个被忽视的领域，但随着项目规模增长，没有测试的代码越来越难以维护。Jest 是目前最流行的 JavaScript 测试框架，配置简单，功能全面。"
---

前端测试一直是个被忽视的领域，但随着项目规模增长，没有测试的代码越来越难以维护。Jest 是目前最流行的 JavaScript 测试框架，配置简单，功能全面。

## 安装和配置

```bash
npm install --save-dev jest babel-jest @babel/preset-env

# Vue 项目还需要
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
    "^@/(.*)$": "<rootDir>/src/$1", // 路径别名
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

## 基础语法

```javascript
// __tests__/utils.spec.js

// describe 分组测试
describe("formatPrice", () => {
  // it/test 单个测试用例
  it("整数金额正确格式化", () => {
    expect(formatPrice(1000)).toBe("1,000.00");
  });

  it("小数金额正确格式化", () => {
    expect(formatPrice(1234.5)).toBe("1,234.50");
  });

  it("零值处理", () => {
    expect(formatPrice(0)).toBe("0.00");
  });

  it("负数处理", () => {
    expect(formatPrice(-100)).toBe("-100.00");
  });
});
```

## 常用断言

```javascript
// 相等
expect(1 + 1).toBe(2); // 严格相等 ===
expect({ a: 1 }).toEqual({ a: 1 }); // 深度相等

// 真假
expect(true).toBeTruthy();
expect(null).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();

// 数字
expect(5).toBeGreaterThan(3);
expect(5).toBeLessThanOrEqual(5);

// 字符串
expect("hello world").toContain("world");
expect("hello").toMatch(/^hel/);

// 数组
expect([1, 2, 3]).toContain(2);
expect([1, 2, 3]).toHaveLength(3);

// 对象
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); // 包含子集即可

// 异常
expect(() => {
  throw new Error("oops");
}).toThrow("oops");
```

## 测试异步代码

```javascript
// async/await 方式（推荐）
it("fetchUser 返回正确数据", async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe("Alice");
});

// Promise 方式
it("fetchUser 返回正确数据", () => {
  return fetchUser(1).then((user) => {
    expect(user.name).toBe("Alice");
  });
});
```

## Mock 函数

```javascript
// jest.fn() 创建 mock 函数
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // 设置返回值
mockFn.mockResolvedValue({ id: 1, name: "Alice" }); // 设置 Promise 返回值

// 调用后验证
mockFn("arg1", "arg2");
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(1);
```

## Mock 模块

```javascript
// 模拟 axios 请求
jest.mock("axios");
import axios from "axios";

it("调用 API 获取用户数据", async () => {
  axios.get.mockResolvedValue({ data: { id: 1, name: "Alice" } });

  const user = await getUser(1);

  expect(axios.get).toHaveBeenCalledWith("/api/users/1");
  expect(user.name).toBe("Alice");
});
```

## Vue 组件测试

```javascript
// __tests__/Button.spec.js
import { mount } from "@vue/test-utils";
import Button from "@/components/Button.vue";

describe("Button 组件", () => {
  it("渲染默认 slot 内容", () => {
    const wrapper = mount(Button, {
      slots: { default: "点击我" },
    });
    expect(wrapper.text()).toContain("点击我");
  });

  it("点击触发 click 事件", async () => {
    const wrapper = mount(Button);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("disabled 状态不触发事件", async () => {
    const wrapper = mount(Button, {
      propsData: { disabled: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("loading 时显示加载状态", () => {
    const wrapper = mount(Button, {
      propsData: { loading: true },
    });
    expect(wrapper.find(".loading-icon").exists()).toBe(true);
  });
});
```

## 测试覆盖率

```bash
npm run test:coverage
```

会生成报告，关注几个指标：

- **Statements**：语句覆盖率
- **Branches**：分支覆盖率（if/else 都走到了吗）
- **Functions**：函数覆盖率
- **Lines**：行覆盖率

不要追求 100%，工具函数、核心业务逻辑重点覆盖，UI 展示类可以少测。

## 小结

- 先从纯函数开始写测试，门槛最低
- `expect().toBe()` 基础，`toEqual()` 用于对象
- 异步测试用 async/await
- 组件测试用 `@vue/test-utils`，测交互行为
- 有了测试，重构代码更有底气
