---
title: "Jest 模块 Mock 技巧"
date: 2019-09-19 16:01:57
tags:
  - Angular
---

写单元测试最头疼的就是依赖问题——你测的是 A 模块，但 A 依赖了 B、C、D，其中 C 还会发网络请求。Mock 解决的就是这个问题：用假的替代品替换真实依赖，让你只关注被测逻辑。

## jest.fn()：Mock 函数

最基础的 Mock 工具，创建一个可以追踪调用情况的空函数：

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

### mock.calls 和 mock.results

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

### 链式返回值

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

### 异步 Mock

```javascript
const mockFn = jest.fn();

// 模拟 Promise 成功
mockFn.mockResolvedValue({ data: "ok" });
await expect(mockFn()).resolves.toEqual({ data: "ok" });

// 模拟 Promise 失败
mockFn.mockRejectedValue(new Error("network error"));
await expect(mockFn()).rejects.toThrow("network error");
```

## jest.mock()：Mock 整个模块

当被测代码 import 了外部模块时，用 `jest.mock()` 替换整个模块：

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

### Mock 第三方库

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

### Mock 部分模块

```javascript
jest.mock("./utils", () => ({
  ...jest.requireActual("./utils"), // 保留其他函数的真实实现
  formatDate: jest.fn(() => "2019-09-19"), // 只 mock 这一个
}));
```

## jest.spyOn()：监视函数调用

`spyOn` 在保留原始实现的同时，追踪函数调用：

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

### 替换浏览器 API

```javascript
test("临时替换 localStorage.setItem", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem");

  localStorage.setItem("token", "abc123");
  expect(spy).toHaveBeenCalledWith("token", "abc123");

  spy.mockRestore();
});
```

## 实战：Mock 完整的 API 请求流程

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

## Mock 定时器

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

## 常见坑

**1. Mock 位置不对**

`jest.mock()` 必须在文件顶层调用，不能放在 `beforeEach` 或 `test` 里。Jest 会自动提升 mock 调用到文件顶部。

**2. 忘记 mockRestore**

`jest.spyOn` 不调用 `mockRestore`，后续测试可能受影响。建议放在 `afterEach` 里：

```javascript
afterEach(() => {
  jest.restoreAllMocks();
});
```

**3. Mock 的模块路径不匹配**

`jest.mock('./api')` 中的路径必须和被测文件里的 `import` 路径完全一致。

**4. 混用 jest.mock 和 require**

如果用了 `jest.mock`，在测试文件里用 `import` 而不是 `require`，否则 mock 可能不生效。

## 小结

- `jest.fn()` 创建可追踪的 mock 函数，可以检查调用次数、参数、返回值
- `jest.mock()` 替换整个模块，适合 mock 第三方库和内部依赖
- `jest.spyOn()` 保留原始实现的同时追踪调用，适合监视而非替换
- Mock 异步操作用 `mockResolvedValue` / `mockRejectedValue`
- Mock 定时器用 `jest.useFakeTimers()` + `jest.advanceTimersByTime()`
- 记得在 `afterEach` 中调用 `jest.restoreAllMocks()` 避免测试间互相影响
