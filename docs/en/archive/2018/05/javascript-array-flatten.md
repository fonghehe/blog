---
title: "Several Ways to Flatten JavaScript Arrays"
date: 2018-05-12 10:12:05
tags:
  - JavaScript
readingTime: 1
description: "Turning a multi-level nested array into a flat one is a common requirement. Here are several implementation approaches with a comparison of when to use each."
---

Turning a multi-level nested array into a flat one is a common requirement. Here are several implementation approaches with a comparison of when to use each.

## The Scenario

```javascript
const nested = [1, [2, 3], [4, [5, 6]], [7, [8, [9]]]];
// Goal: [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## Method 1: Recursion

```javascript
function flatten(arr) {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flatten(item) : item);
  }, []);
}

flatten([1, [2, [3, [4]]]]); // [1, 2, 3, 4]
```

## Method 2: Spread Operator Loop

```javascript
function flatten(arr) {
  while (arr.some((item) => Array.isArray(item))) {
    arr = [].concat(...arr);
  }
  return arr;
}
```

Each iteration peels off one level of nesting until the array is flat.

## Method 3: toString (integers only)

```javascript
[1, [2, [3, [4]]]].toString().split(",").map(Number);
// [1, 2, 3, 4]
```

Only works for arrays of pure integers — limited use cases.

## Method 4: Array.flat (ES2019)

```javascript
// Flatten one level
[1, [2, [3]]]
  .flat() // [1, 2, [3]]

  [
    // Flatten two levels
    (1, [2, [3, [4]]])
  ].flat(2) // [1, 2, 3, [4]]

  [
    // Flatten all levels
    (1, [2, [3, [4]]])
  ].flat(Infinity); // [1, 2, 3, 4]
```

Cleanest option. Supported in Chrome 69+ (late 2018) — needs a polyfill for older environments.

## Flatten to a Specified Depth

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

## Real-World Example

```javascript
// Scenario: tree-structured menu data — get all nodes
const menuTree = [
  { id: 1, name: "Home" },
  {
    id: 2,
    name: "User Management",
    children: [
      { id: 3, name: "User List" },
      { id: 4, name: "Role Management" },
    ],
  },
];

// Get all menu items (including parent nodes)
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

## Performance

For large arrays, the recursive approach is fastest. `Array.flat` is also optimised internally. The `toString` approach is expensive due to string creation.

## Summary

- Daily development: `flat(Infinity)` is cleanest (confirm browser support)
- Needs to support older browsers: use the recursive reduce approach
- Integer-only arrays: `toString().split(',').map(Number)` works too
- Tree data to flat list: use recursion to handle `children`
