---
title: "JavaScriptの非同期イテレーターとfor-await-of"
date: 2019-08-21 17:03:21
tags:
  - JavaScript
readingTime: 5
description: "ES2018 では非同期イテレーター（Async Iterator）と for-await-of 構文が導入され、同期のような書き方で非同期データストリームを処理できるようになりました。この機能はページネーション API、WebSocket メッセージ、ファイルストリームなどのシーンで非常に役立ちます。この記事ではイテレータープロトコルから始めて、非同期イテレーターの原理と実践的な応用を深く理解します。"
wordCount: 1006
---

ES2018 では非同期イテレーター（Async Iterator）と `for-await-of` 構文が導入され、同期のような書き方で非同期データストリームを処理できるようになりました。この機能はページネーション API、WebSocket メッセージ、ファイルストリームなどのシーンで非常に役立ちます。この記事ではイテレータープロトコルから始めて、非同期イテレーターの原理と実践的な応用を深く理解します。

## おさらい：同期イテレーター

非同期イテレーターを理解する前に、同期イテレーターを復習しましょう。オブジェクトを反復可能（iterable）にするには、`Symbol.iterator` メソッドを実装する必要があります：

```js
// カスタム反復可能オブジェクト
const range = {
  from: 1,
  to: 5,

  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;

    return {
      next() {
        if (current <= last) {
          return { value: current++, done: false };
        }
        return { done: true };
      }
    };
  }
};

for (const num of range) {
  console.log(num); // 1, 2, 3, 4, 5
}
```

## 非同期イテレータープロトコル

非同期イテレーターと同期イテレーターの主な違い：

1. メソッド名は `Symbol.asyncIterator` であり、`Symbol.iterator` ではありません
2. `next()` は `{value, done}` ではなく `Promise<{value, done}>` を返します
3. 反復には `for-of` ではなく `for-await-of` を使用します

```js
const asyncRange = {
  from: 1,
  to: 5,

  [Symbol.asyncIterator]() {
    let current = this.from;
    const last = this.to;

    return {
      async next() {
        // 非同期遅延をシミュレート
        await new Promise(resolve => setTimeout(resolve, 100));

        if (current <= last) {
          return { value: current++, done: false };
        }
        return { done: true };
      }
    };
  }
};

async function main() {
  for await (const num of asyncRange) {
    console.log(num); // 1, 2, 3, 4, 5（各 100ms 間隔）
  }
}

main();
```

## 実践：ページネーションAPIデータ取得

実際のプロジェクトでは、特定のページが空データを返すまでページネーション API を処理する必要がよくあります。非同期イテレーターはこのようなシーンに最適です：

```js
// 自動的にページをめくる非同期反復可能オブジェクトを作成
function paginatedApi(endpoint, pageSize = 20) {
  return {
    [Symbol.asyncIterator]() {
      let page = 1;
      let done = false;

      return {
        async next() {
          if (done) return { done: true };

          const response = await fetch(
            `${endpoint}?page=${page}&pageSize=${pageSize}`
          );
          const data = await response.json();

          if (data.items.length === 0) {
            done = true;
            return { done: true };
          }

          page++;
          return { value: data.items, done: false };
        }
      };
    }
  };
}

// 使用
async function fetchAllUsers() {
  const allUsers = [];

  for await (const users of paginatedApi('/api/users', 50)) {
    allUsers.push(...users);
    console.log(`${allUsers.length} 人のユーザーを読み込みました`);
  }

  return allUsers;
}
```

## async generatorで簡略化

`async function*` は非同期イテレーターを作成するより簡潔な方法です：

```js
// async generator を使用してページネーション API を書き直す
async function* paginatedApi(endpoint, pageSize = 20) {
  let page = 1;

  while (true) {
    const response = await fetch(
      `${endpoint}?page=${page}&pageSize=${pageSize}`
    );
    const data = await response.json();

    if (data.items.length === 0) {
      return; // イテレーションを終了
    }

    yield data.items; // データを1バッチ生成
    page++;
  }
}

// 使用方法は完全に同じ
async function main() {
  for await (const users of paginatedApi('/api/users')) {
    console.log(`${users.length} 件のデータを取得しました`);
  }
}
```

## 実践：WebSocketメッセージストリーム

WebSocket のメッセージストリームを非同期反復可能オブジェクトとしてカプセル化します：

```js
async function* websocketMessages(url) {
  const ws = new WebSocket(url);

  // キューと Promise を使用してイベントを反復に変換
  const queue = [];
  let resolve = null;
  let reject = null;

  ws.onmessage = (event) => {
    if (resolve) {
      resolve(JSON.parse(event.data));
      resolve = null;
    } else {
      queue.push(JSON.parse(event.data));
    }
  };

  ws.onerror = (err) => {
    if (reject) {
      reject(err);
    }
  };

  ws.onclose = () => {
    if (resolve) {
      resolve(undefined); // イテレーション終了を通知
    }
  };

  try {
    while (ws.readyState !== WebSocket.CLOSED) {
      if (queue.length > 0) {
        yield queue.shift();
      } else {
        const message = await new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        if (message === undefined) break;
        yield message;
      }
    }
  } finally {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }
}

// 使用
async function handleChatMessages() {
  for await (const message of websocketMessages('wss://chat.example.com')) {
    console.log(`メッセージを受信: ${message.text}`);

    if (message.type === 'system' && message.action === 'disconnect') {
      break; // いつでも break で反復を終了できます
    }
  }
}
```

## 実践：ファイルの行ごとの読み取り

Node.js で大容量ファイルを読み取る場合、非同期イテレーターを使用して1行ずつ処理し、一度にメモリにロードすることを避けられます：

```js
const fs = require('fs');
const readline = require('readline');

async function* readLines(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  // readline は反復可能オブジェクトで、Node 10+ で for-await-of をサポート
  for await (const line of rl) {
    yield line;
  }
}

// 使用
async function processLogFile() {
  let errorCount = 0;
  let warnCount = 0;

  for await (const line of readLines('/var/log/app.log')) {
    if (line.includes('ERROR')) {
      errorCount++;
      console.error(line);
    } else if (line.includes('WARN')) {
      warnCount++;
    }
  }

  console.log(`統計: ${errorCount} 個のエラー, ${warnCount} 個の警告`);
}
```

## 非同期ジェネレーターのメソッド

非同期ジェネレーターも `return()` メソッドと `throw()` メソッドをサポートしています：

```js
async function* dataStream() {
  try {
    yield 1;
    yield 2;
    yield 3;
  } finally {
    // 反復が中断された時にクリーンアップ処理を実行
    console.log('リソースをクリーンアップ');
  }
}

async function main() {
  const stream = dataStream();

  // 通常の反復
  console.log(await stream.next()); // { value: 1, done: false }

  // 早期に反復を終了 — finally が実行される
  await stream.return(); // 出力: リソースをクリーンアップ
  console.log(await stream.next()); // { done: true }
}
```

## 非同期イテレーターと通常イテレーターの変換

```js
// 通常の配列を非同期イテレーターにラップする
async function* toAsyncIterable(syncIterable) {
  for (const item of syncIterable) {
    yield item;
  }
}

// 遅延を追加
async function* delayEach(iterable, ms) {
  for await (const item of iterable) {
    await new Promise(r => setTimeout(r, ms));
    yield item;
  }
}

// フィルタリング
async function* filter(iterable, predicate) {
  for await (const item of iterable) {
    if (predicate(item)) {
      yield item;
    }
  }
}

// 組み合わせて使用
async function main() {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for await (const num of filter(delayEach(numbers, 100), n => n % 2 === 0)) {
    console.log(num); // 2, 4, 6, 8, 10（各 100ms 間隔）
  }
}
```

## RxJSとの比較

| 特性 | for-await-of | RxJS Observable |
|------|-------------|-----------------|
| 学習コスト | 低（ネイティブ構文） | 高（オペレーターの学習が必要） |
| 背圧制御 | コンシューマ駆動（ネイティブ背圧） | 追加処理が必要 |
| オペレーター | 手動実装が必要 | 豊富な組み込みオペレーター |
| キャンセル可能性 | break / return() | unsubscribe |
| 適用シーン | 単純な非同期反復 | 複雑なデータストリーム処理 |

## ブラウザ互換性

- Chrome 63+、Firefox 57+、Safari 12+、Node 10+
- IE 未対応
- Babel + `@babel/plugin-proposal-async-generator-functions` でコンパイル可能

## まとめ

- 非同期イテレーターは `Symbol.asyncIterator` を実装し、`next()` は Promise を返します
- `for-await-of` は同期反復のような構文で非同期データストリームを処理します
- `async function*` は非同期イテレーターを作成する最も簡潔な方法です
- 代表的なシーン：ページネーション API、WebSocket メッセージストリーム、ファイルの行ごとの読み取り
- 非同期イテレーターはネイティブで背圧（backpressure）をサポートし、コンシューマが必要に応じてデータをプルします
- RxJS と比較して学習コストが低く、複雑なオペレーターを必要としないシーンに適しています
