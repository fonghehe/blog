---
title: "Jest 模塊 Mock 技巧"
date: 2019-09-19 16:01:57
tags:
  - Angular
readingTime: 3
description: "寫單元測試最頭疼的就是依賴問題——你測的是 A 模塊，但 A 依賴了 B、C、D，其中 C 還會發網絡請求。Mock 解決的就是這個問題：用假的替代品替換真實依賴，讓你只關注被測邏輯。"
wordCount: 428
---

寫單元測試最頭疼的就是依賴問題——你測的是 A 模塊，但 A 依賴了 B、C、D，其中 C 還會發網絡請求。Mock 解決的就是這個問題：用假的替代品替換真實依賴，讓你只關注被測邏輯。

## jest.fn()：Mock 函數

最基礎的 Mock 工具，創建一個可以追蹤調用情況的空函數：

```javascript
// 被測函數
function forEach(items, callback) {
  for (let i = 0; i < items.length; i++) {
    callback(items[i]);
  }
}

test("forEach 遍歷並調用回調", () => {
  const mockCallback = jest.fn((x) => x * 10);
  forEach([1, 2, 3], mockCallback);

  // 斷言調用次數
  expect(mockCallback.mock.calls.length).toBe(3);

  // 斷言每次調用的參數
  expect(mockCallback.mock.calls[0][0]).toBe(1);
  expect(mockCallback.mock.calls[1][0]).toBe(2);

  // 斷言返回值
  expect(mockCallback.mock.results[0].value).toBe(10);
});
```

### mock.calls 和 mock.results

```javascript
const mockFn = jest.fn((a, b) => a + b);

mockFn(1, 2);
mockFn(3, 4);

// mock.calls: 每次調用的參數數組
expect(mockFn.mock.calls).toEqual([[1, 2], [3, 4]]);

// mock.results: 每次調用的返回值
expect(mockFn.mock.results).toEqual([
  { type: "return", value: 3 },
  { type: "return", value: 7 },
]);
```

### 鏈式返回值

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

### 異步 Mock

```javascript
const mockFn = jest.fn();

// 模擬 Promise 成功
mockFn.mockResolvedValue({ data: "ok" });
await expect(mockFn()).resolves.toEqual({ data: "ok" });

// 模擬 Promise 失敗
mockFn.mockRejectedValue(new Error("network error"));
await expect(mockFn()).rejects.toThrow("network error");
```

## jest.mock()：Mock 整個模塊

當被測代碼 import 了外部模塊時，用 `jest.mock()` 替換整個模塊：

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

// 自動 mock 整個 api 模塊
jest.mock("./api");

test("getUserName 返回大寫用户名", async () => {
  fetchUser.mockResolvedValue({ id: 1, name: "alice" });

  const name = await getUserName(1);
  expect(name).toBe("ALICE");
  expect(fetchUser).toHaveBeenCalledWith(1);
});
```

### Mock 第三方庫

```javascript
jest.mock("axios");
import axios from "axios";

test("getUserData 返回用户數據", async () => {
  axios.get.mockResolvedValue({
    data: { id: 1, name: "Alice" },
  });

  const result = await getUserData(1);
  expect(result.name).toBe("Alice");
  expect(axios.get).toHaveBeenCalledWith("/api/user/1");
});
```

### Mock 部分模塊

```javascript
jest.mock("./utils", () => ({
  ...jest.requireActual("./utils"), // 保留其他函數的真實實現
  formatDate: jest.fn(() => "2019-09-19"), // 只 mock 這一個
}));
```

## jest.spyOn()：監視函數調用

`spyOn` 在保留原始實現的同時，追蹤函數調用：

```javascript
const calculator = {
  add: (a, b) => a + b,
  log: (msg) => console.log(msg),
};

test("add 方法正常工作並可被監視", () => {
  const spy = jest.spyOn(calculator, "add");

  const result = calculator.add(2, 3);
  expect(result).toBe(5); // 原始實現正常工作
  expect(spy).toHaveBeenCalledWith(2, 3);

  spy.mockRestore();
});
```

### 替換瀏覽器 API

```javascript
test("臨時替換 localStorage.setItem", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem");

  localStorage.setItem("token", "abc123");
  expect(spy).toHaveBeenCalledWith("token", "abc123");

  spy.mockRestore();
});
```

## 實戰：Mock 完整的 API 請求流程

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

  test("創建成功返回訂單數據", async () => {
    axios.post.mockResolvedValue({
      data: { code: 0, data: { orderId: "ORD-001" } },
    });

    const order = await createOrder(items);
    expect(order.orderId).toBe("ORD-001");
    expect(axios.post).toHaveBeenCalledWith("/api/orders", { items });
  });

  test("業務錯誤拋出異常", async () => {
    axios.post.mockResolvedValue({
      data: { code: 1001, message: "庫存不足" },
    });

    await expect(createOrder(items)).rejects.toThrow("庫存不足");
  });

  test("網絡錯誤向上拋出", async () => {
    axios.post.mockRejectedValue(new Error("Network Error"));
    await expect(createOrder(items)).rejects.toThrow("Network Error");
  });
});
```

## Mock 定時器

```javascript
test("3 秒後執行回調", () => {
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

## 常見坑

**1. Mock 位置不對**

`jest.mock()` 必須在文件頂層調用，不能放在 `beforeEach` 或 `test` 裏。Jest 會自動提升 mock 調用到文件頂部。

**2. 忘記 mockRestore**

`jest.spyOn` 不調用 `mockRestore`，後續測試可能受影響。建議放在 `afterEach` 裏：

```javascript
afterEach(() => {
  jest.restoreAllMocks();
});
```

**3. Mock 的模塊路徑不匹配**

`jest.mock('./api')` 中的路徑必須和被測文件裏的 `import` 路徑完全一致。

**4. 混用 jest.mock 和 require**

如果用了 `jest.mock`，在測試文件裏用 `import` 而不是 `require`，否則 mock 可能不生效。

## 小結

- `jest.fn()` 創建可追蹤的 mock 函數，可以檢查調用次數、參數、返回值
- `jest.mock()` 替換整個模塊，適合 mock 第三方庫和內部依賴
- `jest.spyOn()` 保留原始實現的同時追蹤調用，適合監視而非替換
- Mock 異步操作用 `mockResolvedValue` / `mockRejectedValue`
- Mock 定時器用 `jest.useFakeTimers()` + `jest.advanceTimersByTime()`
- 記得在 `afterEach` 中調用 `jest.restoreAllMocks()` 避免測試間互相影響
