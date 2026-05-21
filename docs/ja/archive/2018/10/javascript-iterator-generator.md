---
title: "JavaScript イテレーターとジェネレーター"
date: 2018-10-11 14:38:00
tags:
  - JavaScript
readingTime: 2
description: "ES6 のイテレーター（Iterator）とジェネレーター（Generator）はカスタムイテレーションを実装するためのツールで、Vuex や Redux-Saga でもジェネレーターが使われています。"
wordCount: 449
---

ES6 のイテレーター（Iterator）とジェネレーター（Generator）はカスタムイテレーションを実装するためのツールで、Vuex や Redux-Saga でもジェネレーターが使われています。

## イテレータープロトコル

イテレーターは `next()` メソッドを持つオブジェクトで、呼び出すたびに `{ value, done }` を返します：

```javascript
// イテレーターを手動で作成
function createRangeIterator(start, end) {
  let current = start;
  return {
    next() {
      if (current <= end) {
        return { value: current++, done: false };
      }
      return { value: undefined, done: true };
    },
  };
}

const iter = createRangeIterator(1, 3);
iter.next(); // { value: 1, done: false }
iter.next(); // { value: 2, done: false }
iter.next(); // { value: 3, done: false }
iter.next(); // { value: undefined, done: true }
```

## イテラブルプロトコル

`Symbol.iterator` メソッドを実装したオブジェクトはイテラブルで、`for...of`、スプレッド演算子などで使用できます：

```javascript
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}

const range = new Range(1, 5);
for (const n of range) {
  console.log(n);
} // 1 2 3 4 5
console.log([...range]); // [1, 2, 3, 4, 5]
const [first, second] = range; // 分割代入
```

## ジェネレーター

ジェネレーターは `function*` で宣言し、`yield` で実行を一時停止します：

```javascript
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i; // 一時停止して i を返し、次の next() を待つ
  }
}

const gen = range(1, 3);
gen.next(); // { value: 1, done: false }
gen.next(); // { value: 2, done: false }
gen.next(); // { value: 3, done: false }
gen.next(); // { value: undefined, done: true }

// ジェネレーターはイテラブルオブジェクトを返す
for (const n of range(1, 5)) {
  console.log(n);
}
```

## yield による双方向通信

`yield` は値を返すだけでなく、値を受け取ることもできます：

```javascript
function* logger() {
  while (true) {
    const input = yield; // 一時停止して外部からの値を待つ
    console.log("[LOG]", input);
  }
}

const log = logger();
log.next(); // ジェネレーターを開始（最初の yield まで実行）
log.next("1つ目のログ"); // 値を渡して実行を再開
log.next("2つ目のログ");
```

## 実用的な応用：async/await の内部実装

`async/await` は本質的にジェネレーター + Promise のシンタックスシュガーです：

```javascript
// ジェネレーターバージョン
function* fetchUser(id) {
  const user = yield fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = yield fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}

// ジェネレーターを駆動する「エグゼキューター」が必要
// （これが co ライブラリの役割）

// async/await バージョン（同等だが簡潔）
async function fetchUser(id) {
  const user = await fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = await fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}
```

## Redux-Saga のジェネレーター

```javascript
// redux-saga はジェネレーターで非同期フローを記述する
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUser, action.id); // call：非同期関数を呼び出す
    yield put({ type: "FETCH_USER_SUCCESS", user }); // put：アクションをディスパッチ
  } catch (e) {
    yield put({ type: "FETCH_USER_FAILURE", error: e.message });
  }
}
```

これにより、非同期フローのテストが非常に簡単になります（エフェクトオブジェクトをチェックするだけで、実際に非同期操作を実行する必要がありません）。

## まとめ

- イテレータープロトコル：`next()` が `{ value, done }` を返す
- イテラブルプロトコル：`[Symbol.iterator]` を実装して `for...of`、分割代入、スプレッドをサポート
- ジェネレーター：`function*` + `yield` でイテレーターの記述を簡素化
- `async/await` はジェネレーター + Promise のシンタックスシュガー
