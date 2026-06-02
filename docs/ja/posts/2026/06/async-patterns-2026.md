---
title: "JavaScript 非同期パターンの進化：Promise から AsyncIterator まで"
date: 2026-06-02 10:16:23
tags:
  - JavaScript
readingTime: 3
description: "JavaScript の非同期プログラミングは、コールバックから Promise、Generator から Async/Await へと進化した。2026 年の非同期パターンの全体像、AsyncIterator、Observable 提案、非同期リソース管理を網羅する。"
wordCount: 812
---

JavaScript の非同期プログラミングモデルは常に進化し続けている。最初のコールバック地獄から、Promise チェーン、Async/Await の同期的記述まで、各ステップが非同期コードのメンタル負担を軽減してきた。2026 年、非同期パターンの境界はストリーミングデータ、リソース管理、スレッド間通信にまで拡張されている。

## コールバックから Promise へのパラダイムシフト

コールバックのネストは早期の Node.js の象徴的な問題だった。Promise は非同期操作を「ネスト」から「チェーン」に変換した：

```javascript
// コールバック地獄
fs.readFile('a.txt', (err, a) => {
  fs.readFile('b.txt', (err, b) => {
    fs.readFile('c.txt', (err, c) => {
      console.log(a, b, c);
    });
  });
});

// Promise チェーン
Promise.all([
  fs.promises.readFile('a.txt'),
  fs.promises.readFile('b.txt'),
  fs.promises.readFile('c.txt')
]).then(([a, b, c]) => console.log(a, b, c));
```

Promise のコア価値は構文改善だけでなく、標準化されたエラーハンドリングと組み合わせ能力を提供することだ。`Promise.all`、`Promise.race`、`Promise.allSettled` が並列制御を宣言的にした。

## Async/Await の同期的錯覚

Async/Await は非同期コードを同期コードのように見せるが、その基盤メカニズムを理解することが重要：

```javascript
async function fetchUserData(userId) {
  // これら2行は順序的に見える
  const user = await getUser(userId);       // 並列可能
  const posts = await getPosts(userId);     // しかし一緒に書くと実際は順序的

  // 真の並列はこう書く
  const [user, posts] = await Promise.all([
    getUser(userId),
    getPosts(userId)
  ]);

  return { user, posts };
}
```

2026 年のよくある陷阱：`await` を過度に使用して不要な順序実行を引き起こす。原則は——**後続のコードが現在の結果に依存する場合のみ `await` する**。

## AsyncIterator：ストリーミングデータのネイティブサポート

AsyncIterator は非同期データストリームを処理するモダンソリューションで、特にリアルタイムデータ、ページネーションロード、イベントストリームに適している：

```javascript
async function* fetchPages(url) {
  let page = 1;
  while (true) {
    const response = await fetch(`${url}?page=${page}`);
    const data = await response.json();
    if (data.items.length === 0) break;
    yield data.items;
    page++;
  }
}

// for-await-of で消費
async function processAllItems() {
  for await (const items of fetchPages('/api/products')) {
    for (const item of items) {
      await processItem(item);
    }
  }
}
```

AsyncIterator の利点は**遅延評価**——データは必要に応じて生成され、一度にメモリにロードされない。大規模データセットや無限ストリームには、Promise 配列よりも実用的だ。

## AbortController：非同期操作のキャンセル

非同期操作のキャンセルは常に課題だった。`AbortController` は標準化されたキャンセルメカニズムを提供する：

```javascript
async function fetchData(url, signal) {
  try {
    const response = await fetch(url, { signal });
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('リクエストがキャンセルされた');
    }
    throw err;
  }
}

const controller = new AbortController();
fetchData('/api/data', controller.signal).then(data => {
  console.log(data);
});

// 3秒後にキャンセル
setTimeout(() => controller.abort(), 3000);
```

## 構造化並列パターン

2026 年の非同期コードは「構造化並列」を重視——すべての非同期操作が明示的なスコープ内で管理されることを保証する：

```javascript
async function processOrder(orderId) {
  const controller = new AbortController();

  try {
    const [payment, inventory] = await Promise.all([
      processPayment(orderId, controller.signal),
      checkInventory(orderId, controller.signal),
    ]);

    return { payment, inventory };
  } catch (err) {
    controller.abort();
    throw err;
  }
}
```

構造化並列のコア原則：**非同期操作の作成とキャンセルは同じスコープ内にあるべきだ**。

## まとめ

JavaScript の非同期パターンは、より宣言的に、より組み合わせ可能に、よりキャンセルしやすい方向へ進化している。AsyncIterator はストリーミングデータを処理し、AbortController はキャンセルを処理し、構造化並列はライフサイクルを管理する。2026 年の非同期コードは：可能なら並列に、可能ならストリーミングに、可能ならキャンセル可能にすべきだ。
