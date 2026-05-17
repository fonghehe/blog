---
title: "JavaScriptの深いコピー方法の比較"
date: 2019-06-11 11:06:11
tags:
  - JavaScript
readingTime: 1
description: "深いコピーはJavaScriptの面接やプロジェクトで常に話題になるトピックです。多くの方法があり、それぞれトレードオフがあります。"
---

深いコピーはJavaScriptの面接やプロジェクトで常に話題になるトピックです。多くの方法があり、それぞれトレードオフがあります。

## 浅いコピーと深いコピー

```javascript
// 浅いコピー：1レベルのコピー、ネストされたオブジェクトは参照を共有
const obj = { a: 1, b: { c: 2 } };
const shallow = { ...obj }; // またはObject.assign({}, obj)
shallow.b.c = 99;
console.log(obj.b.c); // 99 — 元のオブジェクトが影響を受ける！

// 深いコピー：完全に独立したコピー、参照を共有しない
```

## 方法1：JSON.parse(JSON.stringify(...))

```javascript
const deep = JSON.parse(JSON.stringify(obj));

// ✅ メリット：1行で書ける、ほとんどのケースで高速
// ❌ デメリット：
//   - undefined、Function、Symbolプロパティが失われる
//   - Dateが文字列になる
//   - 循環参照を処理できない（エラーをスロー）
//   - RegExp、Map、Setが失われる
```

## 方法2：structuredClone（モダンAPI）

```javascript
const obj = {
  name: "test",
  date: new Date(),
  map: new Map([["key", "value"]]),
  arr: [1, 2, 3],
};

const clone = structuredClone(obj);
// ✅ Date、Map、Set、ArrayBuffer、循環参照を処理
// ❌ 関数やDOMノードをクローンできない
// ✅ Node.js 17+、モダンブラウザで利用可能
```

## 方法3：手動再帰的クローン

```javascript
function deepClone(obj, map = new WeakMap()) {
  // 非オブジェクトのプリミティブとnullを処理
  if (obj === null || typeof obj !== "object") return obj;

  // 循環参照を処理
  if (map.has(obj)) return map.get(obj);

  // 特殊な型を処理
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (obj instanceof Map) {
    const mapClone = new Map();
    map.set(obj, mapClone);
    obj.forEach((v, k) => mapClone.set(deepClone(k, map), deepClone(v, map)));
    return mapClone;
  }

  // プレーンオブジェクトと配列を処理
  const clone = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);

  for (const key of Reflect.ownKeys(obj)) {
    clone[key] = deepClone(obj[key], map);
  }

  return clone;
}
```

## 選び方

| シナリオ                           | 推奨                              |
| ---------------------------------- | --------------------------------- |
| プレーンなJSONデータ、特殊な型なし | `JSON.parse(JSON.stringify(...))` |
| モダン環境、Date/Map/Setが必要     | `structuredClone`                 |
| 関数の処理が必要、精密な制御       | 手動再帰的実装                    |
| 本番プロジェクト                   | `lodash.cloneDeep`を使用          |

ほとんどのビジネスコードでは`JSON.parse(JSON.stringify(...))`で十分です。特殊な型を処理する必要がある場合は`structuredClone`かlodashを使用しましょう。
