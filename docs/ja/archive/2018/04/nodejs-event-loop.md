---
title: "Node.js イベントループを深く理解する"
date: 2018-04-09 11:02:57
tags:
  - JavaScript
readingTime: 3
description: "Node.js の面接で必ず問われるテーマですが、多くの人は結論だけを暗記して仕組みを理解していません。この記事では実際のコードの実行順序を通してイベントループを解説します。"
wordCount: 767
---

Node.js の面接で必ず問われるテーマですが、多くの人は結論だけを暗記して仕組みを理解していません。この記事では実際のコードの実行順序を通してイベントループを解説します。

## Node.js がシングルスレッドでもノンブロッキングな理由

Node.js のメインスレッドはシングルスレッドですが、I/O 操作（ファイル読み書き、ネットワークリクエスト）は OS に委託して非同期に処理されます。

```
メインスレッド → I/O リクエストを発行 → 続きのコードを実行
                  ↓（OS に委託）
              OS が I/O 完了 → コールバックをイベントキューに追加
                  ↓
メインスレッドが空き → キューからコールバックを取り出して実行
```

これがイベントループの基本的な考え方です。

## イベントループの 6 つのフェーズ

Node.js のイベントループは libuv が実装しており、6 つのフェーズに分かれています：

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout / setInterval のコールバック
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  前のループから遅延された I/O コールバック
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  内部使用のみ
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  新しい I/O イベントを取得（メインフェーズ）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate のコールバック
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  socket.on('close', ...) など
   └───────────────────────────┘
```

## マイクロタスクとマクロタスク

最も混乱しやすい部分です。

**マクロタスク：**

- `setTimeout`
- `setInterval`
- `setImmediate`
- I/O コールバック

**マイクロタスク：**

- `Promise.then/.catch/.finally`
- `process.nextTick`（最も優先度の高いマイクロタスク）
- `queueMicrotask`

**実行ルール：各マクロタスクの実行後、すべてのマイクロタスクを即座に消化し、次のマクロタスクを実行する。**

## 典型的な問題の解析

```javascript
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve()
  .then(() => console.log("3"))
  .then(() => console.log("4"));

process.nextTick(() => console.log("5"));

console.log("6");
```

**実行順序：1 6 5 3 4 2**

分析：

1. `1` — 同期コード
2. `setTimeout` がマクロタスクキューへ
3. `Promise.then` がマイクロタスクキューへ
4. `process.nextTick` が nextTick キューへ（最優先マイクロタスク）
5. `6` — 同期コード
6. **マイクロタスクを消化**：先に nextTick（`5`）、次に Promise.then（`3`、`4`）
7. **次のマクロタスク**：`setTimeout`（`2`）

## setImmediate vs setTimeout(fn, 0)

```javascript
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));
```

**結果は不確定！** メインモジュールで実行した場合、順序はシステムのタイマー精度に依存します。

しかし **I/O コールバックの内部では**、`setImmediate` は**必ず** `setTimeout` より先に実行されます：

```javascript
const fs = require("fs");

fs.readFile("./file.txt", () => {
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// setImmediate が必ず先に出力される
```

理由：I/O コールバックは poll フェーズで実行されます。poll 終了後、ループは直接 check フェーズ（setImmediate）に入り、その後 timers フェーズ（setTimeout）に戻ります。

## process.nextTick の落とし穴

`process.nextTick` のコールバックは各フェーズの切り替え前に実行され、最も優先度が高いです。乱用すると I/O がスタベーションを起こします：

```javascript
// ❌ 再帰的な nextTick — I/O が永遠に実行されない
function loopNextTick() {
  process.nextTick(loopNextTick);
}
loopNextTick();
```

## 実際の応用

```javascript
// 同期コードを非同期化（呼び出し元がイベントリスナーを設定する機会を与える）
class EventEmitter {
  emit(event, data) {
    process.nextTick(() => {
      this.listeners[event]?.forEach((fn) => fn(data));
    });
  }
}

// 非同期 API の一貫性を確保する
function readData(callback) {
  if (this.cache) {
    process.nextTick(() => callback(null, this.cache)); // 非同期を保つ
    return;
  }
  fs.readFile("./data", callback);
}
```

## まとめ

- イベントループは Node.js が並行処理を扱うコアメカニズム
- マイクロタスク（Promise、nextTick）は各マクロタスク後に即座に実行される
- `process.nextTick` の優先度は `Promise.then` より高い
- I/O 内部では `setImmediate` が `setTimeout` より先に実行される
- nextTick/Promise での無限再帰は I/O をブロックするため避ける
