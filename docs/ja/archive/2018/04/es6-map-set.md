---
title: "ES6 Map と Set"
date: 2018-04-07 09:32:14
tags:
  - ES6
readingTime: 2
description: "ES6 では `Map` と `Set` という 2 つの新しいデータ構造が導入されました。しかし多くの開発者はいまだにオブジェクトと配列を使い続けています。どんな場面でこれらが適しているかを見ていきましょう。"
wordCount: 286
---

ES6 では `Map` と `Set` という 2 つの新しいデータ構造が導入されました。しかし多くの開発者はいまだにオブジェクトと配列を使い続けています。どんな場面でこれらが適しているかを見ていきましょう。

## Set：重複のないコレクション

```javascript
// 最もよく使われる場面：配列の重複除去
const arr = [1, 2, 2, 3, 3, 4];
const unique = [...new Set(arr)];
console.log(unique); // [1, 2, 3, 4]

// 文字列の重複除去にも使える
const chars = [...new Set("abracadabra")].join("");
console.log(chars); // 'abrcd'
```

```javascript
// Set の基本操作
const set = new Set([1, 2, 3]);

set.add(4); // 追加
set.delete(1); // 削除
set.has(2); // 検索：true
set.size; // サイズ：3

// イテレーション
for (const item of set) {
  console.log(item);
}
set.forEach((item) => console.log(item));
```

```javascript
// 集合演算
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// 和集合
const union = new Set([...a, ...b]); // {1, 2, 3, 4}

// 積集合
const intersection = new Set([...a].filter((x) => b.has(x))); // {2, 3}

// 差集合（a にあって b にないもの）
const diff = new Set([...a].filter((x) => !b.has(x))); // {1}
```

## Map：任意の型をキーにできるキーバリューペア

通常のオブジェクトのキーは文字列か Symbol のみです。Map のキーは任意の値を使えます：

```javascript
const map = new Map();

// オブジェクトをキーに
const userKey = { id: 1 };
map.set(userKey, { name: "山田太郎", age: 25 });
map.get(userKey); // { name: '山田太郎', age: 25 }

// 関数をキーに
map.set(function () {}, "some value");

// 基本操作
map.set("key", "value");
map.get("key"); // 'value'
map.has("key"); // true
map.delete("key");
map.size; // サイズ
```

```javascript
// 初期化
const map = new Map([
  ["name", "山田太郎"],
  ["age", 25],
  ["city", "東京"],
]);

// イテレーション
for (const [key, value] of map) {
  console.log(key, value);
}

// 変換
const obj = Object.fromEntries(map); // Map → オブジェクト
const arr = [...map]; // Map → 配列
```

## Map をオブジェクトの代わりに使う場面

```javascript
// シナリオ：頻繁にキーを追加・削除するキャッシュ
// オブジェクトの場合：
const cache = {};
cache[userId] = data;
delete cache[userId];
Object.keys(cache).length; // 非効率

// Map の場合：
const cache = new Map();
cache.set(userId, data);
cache.delete(userId);
cache.size; // O(1)
```

```javascript
// シナリオ：文字列以外のキー
// オブジェクトの場合：キーが toString() され、異なるオブジェクトが同じキーになる
const obj = {};
obj[{ id: 1 }] = "a";
obj[{ id: 2 }] = "b";
console.log(obj); // { '[object Object]': 'b' } — キーが上書きされた！

// Map の場合：キーは参照であり、互いに干渉しない
const map = new Map();
const key1 = { id: 1 };
const key2 = { id: 2 };
map.set(key1, "a");
map.set(key2, "b");
map.size; // 2、正しい
```

## まとめ

- `Set`：重複のないコレクション。配列の重複除去や集合演算に最適
- `Map`：キーが任意の型のキーバリューペア。頻繁な追加・削除や文字列以外のキーに適している
- 通常の場面ではオブジェクトと配列で十分。新しい API を使うこと自体が目的にならないようにする
