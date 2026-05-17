---
title: "Promise チェーンと エラーハンドリング"
date: 2018-04-24 15:30:06
tags:
  - JavaScript
readingTime: 2
description: "以前 Promise の基礎について書きました。今回はチェーンとエラーハンドリングに特化して解説します。細かい落とし穴が多い部分です。"
---

以前 Promise の基礎について書きました。今回はチェーンとエラーハンドリングに特化して解説します。細かい落とし穴が多い部分です。

## チェーンの基礎

```javascript
// then は新しい Promise を返すため、チェーンできる
fetchUser(1)
  .then((user) => fetchOrders(user.id)) // 新しい Promise を返す
  .then((orders) => fetchDetails(orders)) // チェーン継続
  .then((details) => {
    console.log(details);
  })
  .catch((err) => {
    console.error("どこかでエラーが起きたらここへ", err);
  });
```

ポイント：`then` のコールバックが何を返すか、それを次の `then` が受け取ります。

```javascript
Promise.resolve(1)
  .then((v) => v + 1) // 普通の値 2 を返す
  .then((v) => v * 2) // 普通の値 4 を返す
  .then((v) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(v + 10), 1000);
    });
  }) // Promise を返す — 完了を待つ
  .then((v) => console.log(v)); // 14（1秒後）
```

## エラーハンドリングの方法

```javascript
// 方法 1：チェーン末尾の .catch（推奨）
fetchUser(1)
  .then(processUser)
  .then(saveUser)
  .catch((err) => {
    // チェーン内のどこかの rejection もここに来る
    console.error(err);
  });

// 方法 2：then の第 2 引数（非推奨 — 見落としやすい）
fetchUser(1)
  .then(processUser, (err) => console.error("fetchUser 失敗"))
  .then(saveUser, (err) => console.error("processUser 失敗"));

// 方法 3：async/await + try/catch（最も明快）
async function handleUser() {
  try {
    const user = await fetchUser(1);
    const processed = await processUser(user);
    await saveUser(processed);
  } catch (err) {
    console.error(err);
  }
}
```

## よくある落とし穴

**落とし穴 1：catch の後もチェーンが続く**

```javascript
fetchUser(1)
  .catch((err) => {
    console.error(err);
    // return なし → 後続の then は undefined を受け取る
    // return あり → 後続の then は戻り値を受け取る
    // throw あり → 後続の then はスキップされ、次の catch が受け取る
  })
  .then((result) => {
    // エラーがあっても、ここは実行される！
    console.log(result); // undefined（catch で return していないため）
  });
```

**落とし穴 2：return を忘れる**

```javascript
// 間違い：return なし — 次のステップは undefined を受け取る
fetchUser(1)
  .then((user) => {
    fetchOrders(user.id); // return なし！
  })
  .then((orders) => {
    console.log(orders); // undefined
  });

// 正しい
fetchUser(1)
  .then((user) => {
    return fetchOrders(user.id); // return が重要
  })
  .then((orders) => {
    console.log(orders); // 正しい orders データ
  });
```

**落とし穴 3：Promise コンストラクター内の同期エラー**

```javascript
const p = new Promise((resolve, reject) => {
  throw new Error("同期エラー"); // これは Promise にキャッチされ、rejection になる
});

p.catch((err) => console.error(err)); // '同期エラー'
```

## 並行処理の制御

```javascript
// すべて並行実行、全部完了するまで待つ
const [users, orders, products] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
]);

// 最初に解決したものを取得
const result = await Promise.race([
  fetchWithTimeout(5000),
  new Promise((_, reject) => setTimeout(() => reject("タイムアウト"), 5000)),
]);

// 全部完了、成功・失敗を問わない（ES2020）
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(), // これが失敗しても全体には影響しない
]);
```

## まとめ

- `then` は値か Promise を返して次に連鎖させられる
- チェーン末尾の `catch` で前のどんなエラーも捕捉できる
- よくある落とし穴：`return` の忘れ、`catch` 後もチェーンが続くこと
- 並行処理：`Promise.all`（全成功必須）、`Promise.allSettled`（成否問わず）
