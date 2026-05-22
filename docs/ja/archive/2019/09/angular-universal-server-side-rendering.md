---
title: "Jestモジュールモックテクニック"
date: 2019-09-19 16:01:57
tags:
  - Angular
readingTime: 4
description: "ユニットテストで最も厄介なのは依存関係の問題です——テスト対象は A モジュールですが、A は B、C、D に依存しており、C はさらにネットワークリクエストを送信します。Mock はこの問題を解決します：本物の依存関係を偽の代替品で置き換え、テスト対象のロジックだけに集中できるようにします。"
wordCount: 766
---

ユニットテストで最も厄介なのは依存関係の問題です——テスト対象は A モジュールですが、A は B、C、D に依存しており、C はさらにネットワークリクエストを送信します。Mock はこの問題を解決します：本物の依存関係を偽の代替品で置き換え、テスト対象のロジックだけに集中できるようにします。

## jest.fn()：Mock 関数

最も基本的な Mock ツールで、呼び出し状況を追跡できる空の関数を作成します：

```javascript
// テスト対象の関数
function forEach(items, callback) {
  for (let i = 0; i < items.length; i++) {
    callback(items[i]);
  }
}

test("forEach がコールバックを反復して呼び出す", () => {
  const mockCallback = jest.fn((x) => x * 10);
  forEach([1, 2, 3], mockCallback);

  // 呼び出し回数をアサート
  expect(mockCallback.mock.calls.length).toBe(3);

  // 各呼び出しのパラメータをアサート
  expect(mockCallback.mock.calls[0][0]).toBe(1);
  expect(mockCallback.mock.calls[1][0]).toBe(2);

  // 戻り値をアサート
  expect(mockCallback.mock.results[0].value).toBe(10);
});
```

### mock.calls と mock.results

```javascript
const mockFn = jest.fn((a, b) => a + b);

mockFn(1, 2);
mockFn(3, 4);

// mock.calls: 各呼び出しのパラメータ配列
expect(mockFn.mock.calls).toEqual([[1, 2], [3, 4]]);

// mock.results: 各呼び出しの戻り値
expect(mockFn.mock.results).toEqual([
  { type: "return", value: 3 },
  { type: "return", value: 7 },
]);
```

### チェーン戻り値

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

### 非同期 Mock

```javascript
const mockFn = jest.fn();

// 模拟 Promise 成功
mockFn.mockResolvedValue({ data: "ok" });
await expect(mockFn()).resolves.toEqual({ data: "ok" });

// 模拟 Promise 失败
mockFn.mockRejectedValue(new Error("network error"));
await expect(mockFn()).rejects.toThrow("network error");
```

## jest.mock()：モジュール全体を Mock する

テスト対象のコードが外部モジュールを import している場合、`jest.mock()` を使用してモジュール全体を置き換えます：

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

// api モジュール全体を自動的に mock
jest.mock("./api");

test("getUserName が大文字のユーザー名を返す", async () => {
  fetchUser.mockResolvedValue({ id: 1, name: "alice" });

  const name = await getUserName(1);
  expect(name).toBe("ALICE");
  expect(fetchUser).toHaveBeenCalledWith(1);
});
```

### サードパーティライブラリの Mock

```javascript
jest.mock("axios");
import axios from "axios";

test("getUserData がユーザーデータを返す", async () => {
  axios.get.mockResolvedValue({
    data: { id: 1, name: "Alice" },
  });

  const result = await getUserData(1);
  expect(result.name).toBe("Alice");
  expect(axios.get).toHaveBeenCalledWith("/api/user/1");
});
```

### モジュールの一部を Mock する

```javascript
jest.mock("./utils", () => ({
  ...jest.requireActual("./utils"), // 他の関数の実際の実装を保持
  formatDate: jest.fn(() => "2019-09-19"), // この関数だけを mock
}));
```

## jest.spyOn()：関数呼び出しの監視

`spyOn` は元の実装を保持したまま、関数呼び出しを追跡します：

```javascript
const calculator = {
  add: (a, b) => a + b,
  log: (msg) => console.log(msg),
};

test("add メソッドが正常に動作し、監視可能", () => {
  const spy = jest.spyOn(calculator, "add");

  const result = calculator.add(2, 3);
  expect(result).toBe(5); // 原始实现正常工作
  expect(spy).toHaveBeenCalledWith(2, 3);

  spy.mockRestore();
});
```

### ブラウザ API の置き換え

```javascript
test("localStorage.setItem を一時的に置き換える", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem");

  localStorage.setItem("token", "abc123");
  expect(spy).toHaveBeenCalledWith("token", "abc123");

  spy.mockRestore();
});
```

## 実践：API リクエストフローの完全 Mock

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

  test("作成成功時に注文データを返す", async () => {
    axios.post.mockResolvedValue({
      data: { code: 0, data: { orderId: "ORD-001" } },
    });

    const order = await createOrder(items);
    expect(order.orderId).toBe("ORD-001");
    expect(axios.post).toHaveBeenCalledWith("/api/orders", { items });
  });

  test("ビジネスエラーで例外をスロー", async () => {
    axios.post.mockResolvedValue({
      data: { code: 1001, message: "库存不足" },
    });

    await expect(createOrder(items)).rejects.toThrow("库存不足");
  });

  test("ネットワークエラーを上位にスロー", async () => {
    axios.post.mockRejectedValue(new Error("Network Error"));
    await expect(createOrder(items)).rejects.toThrow("Network Error");
  });
});
```

## タイマーの Mock

```javascript
test("3 秒後にコールバックを実行", () => {
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

## よくある落とし穴

**1. Mock の位置が正しくない**

`jest.mock()` はファイルのトップレベルで呼び出す必要があり、`beforeEach` や `test` の中に配置することはできません。Jest は自動的に mock 呼び出しをファイルの先頭に巻き上げます。

**2. mockRestore を忘れる**

`jest.spyOn` で `mockRestore` を呼び出さないと、後続のテストに影響を与える可能性があります。`afterEach` 内に配置することをお勧めします：

```javascript
afterEach(() => {
  jest.restoreAllMocks();
});
```

**3. Mock のモジュールパスが一致しない**

`jest.mock('./api')` のパスは、テスト対象ファイル内の `import` パスと完全に一致している必要があります。

**4. jest.mock と require の混用**

`jest.mock` を使用する場合、テストファイルでは `require` ではなく `import` を使用してください。そうしないと mock が有効にならない可能性があります。

## まとめ

- `jest.fn()` は追跡可能な mock 関数を作成し、呼び出し回数、パラメータ、戻り値を確認できます
- `jest.mock()` はモジュール全体を置き換え、サードパーティライブラリや内部依存関係の mock に適しています
- `jest.spyOn()` は元の実装を保持しながら呼び出しを追跡し、置き換えではなく監視に適しています
- 非同期操作の Mock には `mockResolvedValue` / `mockRejectedValue` を使用
- タイマーの Mock には `jest.useFakeTimers()` + `jest.advanceTimersByTime()` を使用
- `afterEach` で `jest.restoreAllMocks()` を呼び出してテスト間の干渉を防ぐことを忘れずに
