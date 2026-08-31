---
title: "Jest Mock Module Techniques"
date: 2019-09-19 16:01:57
tags:
  - Angular
readingTime: 3
description: "The most painful part of writing unit tests is dealing with dependencies—you want to test module A, but A depends on B, C, and D, and C even makes network requests. That's exactly what mocking solves: it swaps real dependencies for fake stand-ins so you can focus on the logic under test."
wordCount: 308
---

The most painful part of writing unit tests is dealing with dependencies—you want to test module A, but A depends on B, C, and D, and C even makes network requests. That's exactly what mocking solves: it swaps real dependencies for fake stand-ins so you can focus on the logic under test.

## jest.fn(): Mock Functions

The most basic mocking tool—it creates an empty function that tracks how it was called:

```javascript
// 被测函数
function forEach(items, callback) {
  for (let i = 0; i < items.length; i++) {
    callback(items[i]);
  }
}

test("forEach 遍历并调用回调", () => {
  const mockCallback = jest.fn((x) => x * 10);
  forEach([1, 2, 3], mockCallback);

  // 断言调用次数
  expect(mockCallback.mock.calls.length).toBe(3);

  // 断言每次调用的参数
  expect(mockCallback.mock.calls[0][0]).toBe(1);
  expect(mockCallback.mock.calls[1][0]).toBe(2);

  // 断言返回值
  expect(mockCallback.mock.results[0].value).toBe(10);
});
```

### mock.calls and mock.results

```javascript
const mockFn = jest.fn((a, b) => a + b);

mockFn(1, 2);
mockFn(3, 4);

// mock.calls: 每次调用的参数数组
expect(mockFn.mock.calls).toEqual([[1, 2], [3, 4]]);

// mock.results: 每次调用的返回值
expect(mockFn.mock.results).toEqual([
  { type: "return", value: 3 },
  { type: "return", value: 7 },
]);
```

### Chained Return Values

```javascript
const mockFn = jest.fn();
mockFn
  .mockReturnValueOnce("first call")
  .mockReturnValueOnce("second call")
  .mockReturnValue("default");

expect(mockFn()).toBe("first call");
expect(mockFn()).toBe("second call");
expect(mockFn()).toBe("default");
```

### Async Mocks

```javascript
const mockFn = jest.fn();

// 模拟 Promise 成功
mockFn.mockResolvedValue({ data: "ok" });
await expect(mockFn()).resolves.toEqual({ data: "ok" });

// 模拟 Promise 失败
mockFn.mockRejectedValue(new Error("network error"));
await expect(mockFn()).rejects.toThrow("network error");
```

## jest.mock(): Mock an Entire Module

When the code under test imports an external module, use `jest.mock()` to replace the whole module:

```javascript
// api.js
export function fetchUser(id) {
  return fetch(`/api/user/${id}`).then((r) => r.json());
}

// userService.js
import { fetchUser } from "./api";

export async function getUserName(id) {
  const user = await fetchUser(id);
  return user.name.toUpperCase();
}
```

```javascript
// userService.test.js
import { getUserName } from "./userService";
import { fetchUser } from "./api";

// 自动 mock 整个 api 模块
jest.mock("./api");

test("getUserName 返回大写用户名", async () => {
  fetchUser.mockResolvedValue({ id: 1, name: "alice" });

  const name = await getUserName(1);
  expect(name).toBe("ALICE");
  expect(fetchUser).toHaveBeenCalledWith(1);
});
```

### Mocking a Third-Party Library

```javascript
jest.mock("axios");
import axios from "axios";

test("getUserData 返回用户数据", async () => {
  axios.get.mockResolvedValue({
    data: { id: 1, name: "Alice" },
  });

  const result = await getUserData(1);
  expect(result.name).toBe("Alice");
  expect(axios.get).toHaveBeenCalledWith("/api/user/1");
});
```

### Mocking Part of a Module

```javascript
jest.mock("./utils", () => ({
  ...jest.requireActual("./utils"), // 保留其他函数的真实实现
  formatDate: jest.fn(() => "2019-09-19"), // 只 mock 这一个
}));
```

## jest.spyOn(): Spy on Function Calls

`jest.spyOn` tracks a function's calls while keeping its original implementation:

```javascript
const calculator = {
  add: (a, b) => a + b,
  log: (msg) => console.log(msg),
};

test("add 方法正常工作并可被监视", () => {
  const spy = jest.spyOn(calculator, "add");

  const result = calculator.add(2, 3);
  expect(result).toBe(5); // 原始实现正常工作
  expect(spy).toHaveBeenCalledWith(2, 3);

  spy.mockRestore();
});
```

### Replacing a Browser API

```javascript
test("临时替换 localStorage.setItem", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem");

  localStorage.setItem("token", "abc123");
  expect(spy).toHaveBeenCalledWith("token", "abc123");

  spy.mockRestore();
});
```

## In Practice: Mocking a Complete API Request Flow

```javascript
// services/orderService.js
import axios from "axios";

export async function createOrder(items) {
  const res = await axios.post("/api/orders", { items });
  if (res.data.code !== 0) {
    throw new Error(res.data.message);
  }
  return res.data.data;
}
```

```javascript
// services/orderService.test.js
jest.mock("axios");
import axios from "axios";
import { createOrder } from "./orderService";

describe("createOrder", () => {
  const items = [{ id: 1, qty: 2 }];

  test("创建成功返回订单数据", async () => {
    axios.post.mockResolvedValue({
      data: { code: 0, data: { orderId: "ORD-001" } },
    });

    const order = await createOrder(items);
    expect(order.orderId).toBe("ORD-001");
    expect(axios.post).toHaveBeenCalledWith("/api/orders", { items });
  });

  test("业务错误抛出异常", async () => {
    axios.post.mockResolvedValue({
      data: { code: 1001, message: "库存不足" },
    });

    await expect(createOrder(items)).rejects.toThrow("库存不足");
  });

  test("网络错误向上抛出", async () => {
    axios.post.mockRejectedValue(new Error("Network Error"));
    await expect(createOrder(items)).rejects.toThrow("Network Error");
  });
});
```

## Mocking Timers

```javascript
test("3 秒后执行回调", () => {
  jest.useFakeTimers();

  const callback = jest.fn();
  setTimeout(callback, 3000);

  jest.advanceTimersByTime(2000);
  expect(callback).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
});
```

## Common Pitfalls

**1. Wrong placement of the mock call**

`jest.mock()` must be called at the top level of the file—not inside `beforeEach` or `test`. Jest automatically hoists mock calls to the top of the file.

**2. Forgetting mockRestore**

If you don't call `mockRestore` after `jest.spyOn`, subsequent tests may be affected. It's best to put it in `afterEach`:

```javascript
afterEach(() => {
  jest.restoreAllMocks();
});
```

**3. Mismatched module paths**

The path in `jest.mock('./api')` must match the `import` path in the file under test exactly.

**4. Mixing jest.mock with require**

Once you use `jest.mock`, use `import` rather than `require` in your test file, otherwise the mock may not take effect.

## Summary

- `jest.fn()` creates a trackable mock function; you can inspect call count, arguments, and return values.
- `jest.mock()` replaces an entire module—ideal for mocking third-party libraries and internal dependencies.
- `jest.spyOn()` keeps the original implementation while tracking calls—good for spying rather than replacing.
- Use `mockResolvedValue` / `mockRejectedValue` to mock async operations.
- Use `jest.useFakeTimers()` + `jest.advanceTimersByTime()` to mock timers.
- Remember to call `jest.restoreAllMocks()` in `afterEach` to prevent tests from interfering with one another.
