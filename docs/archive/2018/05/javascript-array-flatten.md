---
title: "JavaScript 数组扁平化的几种写法"
date: 2018-05-12 10:12:05
tags:
  - JavaScript
readingTime: 1
description: "把多层嵌套数组变成一维数组是常见需求。记录几种实现方式，并对比适用场景。"
---

把多层嵌套数组变成一维数组是常见需求。记录几种实现方式，并对比适用场景。

## 场景

```javascript
const nested = [1, [2, 3], [4, [5, 6]], [7, [8, [9]]]];
// 目标：[1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## 方法一：递归

```javascript
function flatten(arr) {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flatten(item) : item);
  }, []);
}

flatten([1, [2, [3, [4]]]]); // [1, 2, 3, 4]
```

## 方法二：展开运算符循环

```javascript
function flatten(arr) {
  while (arr.some((item) => Array.isArray(item))) {
    arr = [].concat(...arr);
  }
  return arr;
}
```

每次循环展开一层，直到没有嵌套为止。

## 方法三：toString（限整数）

```javascript
[1, [2, [3, [4]]]].toString().split(",").map(Number);
// [1, 2, 3, 4]
```

只适合纯整数数组，有局限性。

## 方法四：Array.flat（ES2019）

```javascript
// 展开一层
[1, [2, [3]]]
  .flat() // [1, 2, [3]]

  [
    // 展开两层
    (1, [2, [3, [4]]])
  ].flat(2) // [1, 2, 3, [4]]

  [
    // 无限层展开
    (1, [2, [3, [4]]])
  ].flat(Infinity); // [1, 2, 3, 4]
```

最简洁，2018 年底 Chrome 69+ 支持，需要 polyfill。

## 指定深度展开

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

## 实际项目场景

```javascript
// 场景：树形菜单数据，获取所有叶子节点
const menuTree = [
  { id: 1, name: "首页" },
  {
    id: 2,
    name: "用户管理",
    children: [
      { id: 3, name: "用户列表" },
      { id: 4, name: "角色管理" },
    ],
  },
];

// 获取所有菜单项（包括父级）
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

## 性能对比

对于大数组，递归方式最快；`Array.flat` 内部也是优化的；`toString` 方式创建字符串成本高。

## 小结

- 日常开发：`flat(Infinity)` 最简洁（确认目标环境支持）
- 需要兼容旧浏览器：递归 reduce 方式
- 只有整数：`toString().split(',').map(Number)` 也行
- 树形数据到平铺列表：用递归，处理 `children`