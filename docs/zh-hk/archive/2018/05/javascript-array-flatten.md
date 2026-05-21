---
title: "JavaScript 數組扁平化的幾種寫法"
date: 2018-05-12 10:12:05
tags:
  - JavaScript
readingTime: 1
description: "把多層嵌套數組變成一維數組是常見需求。記錄幾種實現方式，並對比適用場景。"
wordCount: 211
---

把多層嵌套數組變成一維數組是常見需求。記錄幾種實現方式，並對比適用場景。

## 場景

```javascript
const nested = [1, [2, 3], [4, [5, 6]], [7, [8, [9]]]];
// 目標：[1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## 方法一：遞歸

```javascript
function flatten(arr) {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flatten(item) : item);
  }, []);
}

flatten([1, [2, [3, [4]]]]); // [1, 2, 3, 4]
```

## 方法二：展開運算符循環

```javascript
function flatten(arr) {
  while (arr.some((item) => Array.isArray(item))) {
    arr = [].concat(...arr);
  }
  return arr;
}
```

每次循環展開一層，直到沒有嵌套為止。

## 方法三：toString（限整數）

```javascript
[1, [2, [3, [4]]]].toString().split(",").map(Number);
// [1, 2, 3, 4]
```

只適合純整數數組，有侷限性。

## 方法四：Array.flat（ES2019）

```javascript
// 展開一層
[1, [2, [3]]]
  .flat() // [1, 2, [3]]

  [
    // 展開兩層
    (1, [2, [3, [4]]])
  ].flat(2) // [1, 2, 3, [4]]

  [
    // 無限層展開
    (1, [2, [3, [4]]])
  ].flat(Infinity); // [1, 2, 3, 4]
```

最簡潔，2018 年底 Chrome 69+ 支持，需要 polyfill。

## 指定深度展開

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

## 實際項目場景

```javascript
// 場景：樹形菜單數據，獲取所有葉子節點
const menuTree = [
  { id: 1, name: "首頁" },
  {
    id: 2,
    name: "用户管理",
    children: [
      { id: 3, name: "用户列表" },
      { id: 4, name: "角色管理" },
    ],
  },
];

// 獲取所有菜單項（包括父級）
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

## 性能對比

對於大數組，遞歸方式最快；`Array.flat` 內部也是優化的；`toString` 方式創建字符串成本高。

## 小結

- 日常開發：`flat(Infinity)` 最簡潔（確認目標環境支持）
- 需要兼容舊瀏覽器：遞歸 reduce 方式
- 只有整數：`toString().split(',').map(Number)` 也行
- 樹形數據到平鋪列表：用遞歸，處理 `children`