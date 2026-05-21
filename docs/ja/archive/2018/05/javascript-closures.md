---
title: "JavaScriptクロージャの深い理解"
date: 2018-05-10 10:41:26
tags:
  - JavaScript
readingTime: 3
description: "クロージャはJavaScriptの面接で必ず問われるトピックですが、本当に理解している人は多くありません。この記事ではレキシカルスコープから出発して、クロージャとは何か、そして実際のエンジニアリングでの応用を説明します。"
wordCount: 543
---

クロージャはJavaScriptの面接で必ず問われるトピックですが、本当に理解している人は多くありません。この記事ではレキシカルスコープから出発して、クロージャとは何か、そして実際のエンジニアリングでの応用を説明します。

## レキシカルスコープ：クロージャの基礎

JavaScriptはレキシカルスコープ（静的スコープとも呼ばれる）を使用します：**関数のスコープは呼び出し時ではなく、関数の定義時に決まります**。

```javascript
const x = 10;

function outer() {
  const y = 20;

  function inner() {
    const z = 30;
    console.log(x, y, z); // 10, 20, 30
    // innerはouterとグローバルの変数にアクセスできる
    // これは関数の定義場所によって決まる
  }

  inner();
}

outer();
```

## クロージャとは何か

**クロージャ = 関数 + 定義時のレキシカル環境**

内部関数が外部から参照され、外部関数の変数がガベージコレクションされなくなる時、クロージャが形成されます：

```javascript
function makeCounter() {
  let count = 0; // この変数はクロージャに「閉じ込められる」

  return function () {
    count++;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3

// counter関数がまだ参照しているため、countは破棄されない
```

## クロージャの古典的な落とし穴

```javascript
// ❌ 古典的な問題：ループ内のクロージャ
for (var i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 5 5 5 5 5 を出力（0 1 2 3 4 ではない）
  }, i * 1000);
}

// 理由：varにはブロックスコープがない — すべてのコールバックが同じiを参照
// ループ終了時にi = 5になるため、すべてのコールバックが5を出力
```

**解決策1：let（推奨）**

```javascript
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 0 1 2 3 4（letは各ループで新しいバインディングを作成）
  }, i * 1000);
}
```

**解決策2：IIFEで新しいスコープを作成**

```javascript
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => {
      console.log(j); // 0 1 2 3 4
    }, j * 1000);
  })(i);
}
```

## 実際の応用シナリオ

### モジュールパターン（プライベート状態のカプセル化）

```javascript
const bankAccount = (function () {
  let balance = 0; // プライベート — 外部から直接アクセス不可

  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) {
        throw new Error("残高不足");
      }
      balance -= amount;
      return balance;
    },
    getBalance() {
      return balance;
    },
  };
})();

bankAccount.deposit(1000); // 1000
bankAccount.withdraw(200); // 800
bankAccount.getBalance(); // 800
// bankAccount.balance → undefined（直接アクセス不可）
```

### 関数ファクトリー

```javascript
function multiply(multiplier) {
  return function (number) {
    return number * multiplier;
  };
}

const double = multiply(2);
const triple = multiply(3);

double(5); // 10
triple(5); // 15
```

### メモ化（Memoization）

```javascript
function memoize(fn) {
  const cache = new Map(); // クロージャでキャッシュを保持

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveFn = memoize(function (n) {
  // 重い処理をシミュレート
  let result = 0;
  for (let i = 0; i < n * 1000000; i++) result += i;
  return result;
});

expensiveFn(100); // 初回：遅い
expensiveFn(100); // 2回目：即時（キャッシュヒット）
```

## クロージャとメモリリーク

クロージャはガベージコレクションを妨げます。不適切に使うとメモリリークの原因になります：

```javascript
function attachHandler() {
  const largeData = new Array(1000000).fill("data");

  document.getElementById("btn").addEventListener("click", function () {
    // コールバックがlargeDataを参照しているため、GCできない
    console.log(largeData.length);
  });
}
```

**解決策：** 使用後に手動で参照を解除するかイベントリスナーを削除：

```javascript
// Vueコンポーネントの場合
mounted() {
  this.handler = () => { ... }
  element.addEventListener('click', this.handler)
},
beforeDestroy() {
  element.removeEventListener('click', this.handler)  // クリーンアップ
}
```

## まとめ

- クロージャ = 関数 + 定義時のレキシカル環境
- ループ内では`let`を使ってクロージャの古典的な落とし穴を避ける
- クロージャはプライベート状態のカプセル化・関数ファクトリー・メモ化に活用
- 大量のデータを保持する不要なクロージャに注意 — メモリリークの原因になりうる
