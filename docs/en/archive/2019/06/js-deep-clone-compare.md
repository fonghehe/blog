---
title: "Comparing JavaScript Deep Clone Approaches"
date: 2019-06-11 11:06:11
tags:
  - JavaScript
readingTime: 1
description: "Deep cloning is a topic that comes up constantly in JavaScript interviews and projects. There are many ways to do it — each with its own trade-offs."
wordCount: 93
---

Deep cloning is a topic that comes up constantly in JavaScript interviews and projects. There are many ways to do it — each with its own trade-offs.

## Shallow Clone vs Deep Clone

```javascript
// Shallow clone: first-level copy, nested objects still share references
const obj = { a: 1, b: { c: 2 } };
const shallow = { ...obj }; // or Object.assign({}, obj)
shallow.b.c = 99;
console.log(obj.b.c); // 99 — original is affected!

// Deep clone: completely independent copy, no shared references
```

## Approach 1: JSON.parse(JSON.stringify(...))

```javascript
const deep = JSON.parse(JSON.stringify(obj));

// ✅ Pros: one-liner, fast for most cases
// ❌ Cons:
//   - Loses undefined, Function, Symbol properties
//   - Date becomes a string
//   - Cannot handle circular references (throws)
//   - Loses RegExp, Map, Set
```

## Approach 2: structuredClone (Modern API)

```javascript
const obj = {
  name: "test",
  date: new Date(),
  map: new Map([["key", "value"]]),
  arr: [1, 2, 3],
};

const clone = structuredClone(obj);
// ✅ Handles Date, Map, Set, ArrayBuffer, circular references
// ❌ Cannot clone functions or DOM nodes
// ✅ Available in Node.js 17+, modern browsers
```

## Approach 3: Manual Recursive Clone

```javascript
function deepClone(obj, map = new WeakMap()) {
  // Handle non-object primitives and null
  if (obj === null || typeof obj !== "object") return obj;

  // Handle circular references
  if (map.has(obj)) return map.get(obj);

  // Handle special types
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (obj instanceof Map) {
    const mapClone = new Map();
    map.set(obj, mapClone);
    obj.forEach((v, k) => mapClone.set(deepClone(k, map), deepClone(v, map)));
    return mapClone;
  }

  // Handle plain objects and arrays
  const clone = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);

  for (const key of Reflect.ownKeys(obj)) {
    clone[key] = deepClone(obj[key], map);
  }

  return clone;
}
```

## How to Choose

| Scenario                                  | Recommendation                    |
| ----------------------------------------- | --------------------------------- |
| Plain JSON data, no special types         | `JSON.parse(JSON.stringify(...))` |
| Modern environment, need Date/Map/Set     | `structuredClone`                 |
| Need to handle functions, precise control | Manual recursive implementation   |
| Production project                        | Use `lodash.cloneDeep`            |

In most business code, `JSON.parse(JSON.stringify(...))` is sufficient. Use `structuredClone` or lodash when you need to handle special types.
