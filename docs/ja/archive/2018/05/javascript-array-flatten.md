---
title: "JavaScript配列のフラット化：いくつかの方法"
date: 2018-05-12 10:12:05
tags:
  - JavaScript
readingTime: 2
description: "多層ネストされた配列を1次元配列にするのはよくある要件です。いくつかの実装方法を比較し、適切な使用場面を確認します。"
---

多層ネストされた配列を1次元配列にするのはよくある要件です。いくつかの実装方法を比較し、適切な使用場面を確認します。

## シナリオ

```javascript
const nested = [1, [2, 3], [4, [5, 6]], [7, [8, [9]]]];
// 目標：[1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## 方法1：再帰

```javascript
function flatten(arr) {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flatten(item) : item);
  }, []);
}

flatten([1, [2, [3, [4]]]]); // [1, 2, 3, 4]
```

## 方法2：スプレッド演算子ループ

```javascript
function flatten(arr) {
  while (arr.some((item) => Array.isArray(item))) {
    arr = [].concat(...arr);
  }
  return arr;
}
```

ネストがなくなるまで1層ずつ展開します。

## 方法3：toString（整数のみ）

```javascript
[1, [2, [3, [4]]]].toString().split(",").map(Number);
// [1, 2, 3, 4]
```

純粋な整数配列にのみ使用可能。制限があります。

## 方法4：Array.flat（ES2019）

```javascript
// 1層展開
[1, [2, [3]]]
  .flat() // [1, 2, [3]]

  [
    // 2層展開
    (1, [2, [3, [4]]])
  ].flat(2) // [1, 2, 3, [4]]

  [
    // 無限層展開
    (1, [2, [3, [4]]])
  ].flat(Infinity); // [1, 2, 3, 4]
```

最もシンプル。2018年末のChrome 69+でサポート。古い環境ではpolyfillが必要。

## 指定した深さでの展開

```javascript
function flattenDepth(arr, depth = 1) {
  if (depth === 0) return arr.slice();
  return arr.reduce((flat, item) => {
    if (Array.isArray(item) && depth > 0) {
      return flat.concat(flattenDepth(item, depth - 1));
    }
    return flat.concat(item);
  }, []);
}

flattenDepth([1, [2, [3, [4]]]], 2); // [1, 2, 3, [4]]
```

## 実際のプロジェクトでのシナリオ

```javascript
// シナリオ：ツリー構造のメニューデータ、全ノードを取得
const menuTree = [
  { id: 1, name: "ホーム" },
  {
    id: 2,
    name: "ユーザー管理",
    children: [
      { id: 3, name: "ユーザー一覧" },
      { id: 4, name: "ロール管理" },
    ],
  },
];

// 全メニュー項目を取得（親メニューを含む）
function flattenMenu(menus) {
  return menus.reduce((flat, menu) => {
    if (menu.children) {
      return flat.concat(menu, flattenMenu(menu.children));
    }
    return flat.concat(menu);
  }, []);
}

flattenMenu(menuTree);
// [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
```

## パフォーマンス比較

大きな配列の場合、再帰方式が最も速いです。`Array.flat`も内部最適化されています。`toString`方式は文字列生成のコストが高いです。

## まとめ

- 日常開発：`flat(Infinity)`が最もシンプル（対象環境のサポートを確認）
- 旧ブラウザ対応が必要：再帰reduceアプローチ
- 整数のみの場合：`toString().split(',').map(Number)`も可
- ツリーデータをフラットリストへ：`children`を処理する再帰を使用
