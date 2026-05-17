---
title: "JavaScriptイベントループの深い理解"
date: 2018-07-07 10:43:20
tags:
  - JavaScript
readingTime: 2
description: "イベントループ（Event Loop）はJavaScriptの並行処理モデルの核心であり、面接でも頻繁に出る話題です。"
---

イベントループ（Event Loop）はJavaScriptの並行処理モデルの核心であり、面接でも頻繁に出る話題です。

## シングルスレッドとノンブロッキング

JavaScriptはシングルスレッドで、同時に実行できるコードは1つだけです。しかしイベントループを通じて、メインスレッドをブロックせずに非同期操作を処理できます。

## コールスタックとタスクキュー

```
┌────────────────────────────────────┐
│            Call Stack              │  ← 同期コードを実行
├────────────────────────────────────┤
│       Web APIs（ブラウザ提供）       │  ← setTimeout, fetch, DOMイベント
├────────────────────────────────────┤
│   マクロタスクキュー                 │  ← setTimeout, setInterval, I/O
├────────────────────────────────────┤
│   マイクロタスクキュー               │  ← Promise.then, MutationObserver
└────────────────────────────────────┘
```

## 実行順序

1. 現在のコールスタックの同期コードをすべて実行
2. マイクロタスクキューを空にする（すべて実行）
3. マクロタスクを1つ実行
4. ステップ2に戻る

```javascript
console.log("1"); // 同期

setTimeout(() => console.log("2"), 0); // マクロタスク

Promise.resolve()
  .then(() => console.log("3")) // マイクロタスク
  .then(() => console.log("4")); // マイクロタスク

console.log("5"); // 同期

// 出力：1 5 3 4 2
```

分析：

1. 同期：1と5を出力
2. マイクロタスク：3を出力（thenチェーン1番目）、次に4を出力（thenチェーン2番目）
3. マクロタスク：2を出力

## async/awaitの本質

```javascript
async function foo() {
  console.log("A");
  await bar();
  console.log("C"); // awaitの後は.thenコールバックと同等（マイクロタスク）
}

function bar() {
  return Promise.resolve();
}

foo();
console.log("B");

// 出力：A B C
```

`await`は関数の実行を一時停止し、後続のコードをマイクロタスクキューに入れます。

## 典型的な問題

```javascript
async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end"); // マイクロタスク
}

async function async2() {
  console.log("async2");
}

console.log("start");
setTimeout(() => console.log("timeout"), 0);
async1();
new Promise((resolve) => {
  console.log("promise executor");
  resolve();
}).then(() => console.log("promise then"));

console.log("end");

// 出力：
// start
// async1 start
// async2
// promise executor
// end
// async1 end    ← マイクロタスク
// promise then  ← マイクロタスク
// timeout       ← マクロタスク
```

## Node.jsの違い

Node.jsには追加のマクロタスクタイプがあります：`setImmediate`（I/Oコールバック後に実行）と`process.nextTick`（Promiseのマイクロタスクより優先度が高い）。

```javascript
// Node.jsでは
process.nextTick(() => console.log("nextTick")); // 最初
Promise.resolve().then(() => console.log("promise")); // 次
setImmediate(() => console.log("setImmediate")); // 最後

// nextTick → promise → setImmediate
```

## まとめ

- JSはシングルスレッド。イベントループが非同期処理を担う
- マイクロタスク（Promise.then）はマクロタスク（setTimeout）より優先される
- 各マクロタスク実行後、すべてのマイクロタスクが実行される
- `async/await`はPromiseの糖衣構文。`await`の後はマイクロタスク
