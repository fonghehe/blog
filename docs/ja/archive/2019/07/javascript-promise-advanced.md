---
title: "JavaScript Promise 上級パターン"
date: 2019-07-22 16:18:40
tags:
  - JavaScript
readingTime: 2
description: "`Promise` の基本的な使い方（`.then`、`.catch`、`.finally`）は多くの開発者が慣れているでしょう。しかし実際のプロジェクトでは、並行制御、タイムアウト処理、直列実行、成功/失敗問わず全て待つなど、上級なパターンが頻繁に必要になります。この記事では、本番プロジェクトで積み上げた Promi"
wordCount: 406
---

`Promise` の基本的な使い方（`.then`、`.catch`、`.finally`）は多くの開発者が慣れているでしょう。しかし実際のプロジェクトでは、並行制御、タイムアウト処理、直列実行、成功/失敗問わず全て待つなど、上級なパターンが頻繁に必要になります。この記事では、本番プロジェクトで積み上げた Promise の上級パターンをまとめます。

## Promise.all vs Promise.race

2つの基本的な API のおさらい：

```javascript
// Promise.all：全て成功したら成功、1つでも失敗したら失敗
const results = await Promise.all([
  fetch("/api/users"),
  fetch("/api/orders"),
  fetch("/api/products"),
]);

// Promise.race：最初に完了した結果（成功・失敗を問わず）を返す
const result = await Promise.race([
  fetch("/api/data"),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("タイムアウト")), 5000),
  ),
]);
```

## 実践1：Promise.race でリクエストタイムアウトを実装

```javascript
function fetchWithTimeout(url, options = {}, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`リクエストタイムアウト: ${url} (${timeout}ms)`));
      }, timeout);
    }),
  ]);
}

try {
  const response = await fetchWithTimeout("/api/slow-endpoint", {}, 3000);
  const data = await response.json();
} catch (err) {
  console.error(err.message); // "リクエストタイムアウト: /api/slow-endpoint (3000ms)"
}
```

`AbortController` を使って実際にリクエストをキャンセルする方法：

```javascript
function fetchWithAbort(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, { ...options, signal })
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`リクエストタイムアウト: ${url}`);
      }
      throw err;
    });
}
```

## 実践2：Promise.allSettled（2019年はTC39 Stage 3）

`Promise.all` は1つでも失敗すると全体が失敗します。`Promise.allSettled` は全ての Promise が完了するまで待ち（成功・失敗問わず）、各 Promise の状態と結果を返します：

```javascript
// Polyfill（2019年はネイティブサポートなし）
if (!Promise.allSettled) {
  Promise.allSettled = function (promises) {
    return Promise.all(
      promises.map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason }),
        ),
      ),
    );
  };
}

const results = await Promise.allSettled([
  fetch("/api/users").then((r) => r.json()),
  fetch("/api/orders").then((r) => r.json()),
  fetch("/api/products").then((r) => r.json()),
]);

// 成功と失敗を分離
const successes = results
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);
const failures = results
  .filter((r) => r.status === "rejected")
  .map((r) => r.reason);
```

## 実践3：並行数の制御

100件のリクエストを同時に送るとサーバーが耐えられません。並行数を制御する必要があります：

```javascript
class ConcurrencyPool {
  constructor(concurrency = 6) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      this.running++;

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }
}

const pool = new ConcurrencyPool(3); // 最大3件同時
const urls = Array.from({ length: 20 }, (_, i) => `/api/item/${i}`);

const results = await Promise.all(
  urls.map((url) => pool.add(() => fetch(url).then((r) => r.json()))),
);
```

## まとめ

- `Promise.race` はリクエストタイムアウトの実装に最適
- `Promise.allSettled`（2019年はポリフィル必要）で部分的な失敗を適切に処理できる
- 多数の並行リクエスト時はサーバー過負荷防止のために並行数を制御する
- 順序が重要またはリクエストが依存し合う場合は直列実行が必要
