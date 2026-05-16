---
title: "ES6 Map and Set"
date: 2018-04-07 09:32:14
tags:
  - ES6
readingTime: 1
description: "ES6 introduced two new data structures — `Map` and `Set` — but many developers still default to plain objects and arrays. Let's look at which scenarios they're "
---

ES6 introduced two new data structures — `Map` and `Set` — but many developers still default to plain objects and arrays. Let's look at which scenarios they're better suited for.

## Set: A Collection of Unique Values

```javascript
// Most common use case: array deduplication
const arr = [1, 2, 2, 3, 3, 4];
const unique = [...new Set(arr)];
console.log(unique); // [1, 2, 3, 4]

// Also works for string deduplication
const chars = [...new Set("abracadabra")].join("");
console.log(chars); // 'abrcd'
```

```javascript
// Basic Set operations
const set = new Set([1, 2, 3]);

set.add(4); // add
set.delete(1); // remove
set.has(2); // check: true
set.size; // size: 3

// Iteration
for (const item of set) {
  console.log(item);
}
set.forEach((item) => console.log(item));
```

```javascript
// Set operations
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// Union
const union = new Set([...a, ...b]); // {1, 2, 3, 4}

// Intersection
const intersection = new Set([...a].filter((x) => b.has(x))); // {2, 3}

// Difference (in a but not in b)
const diff = new Set([...a].filter((x) => !b.has(x))); // {1}
```

## Map: Key-Value Pairs with Any Key Type

Plain object keys can only be strings or Symbols. Map keys can be anything:

```javascript
const map = new Map();

// Using an object as a key
const userKey = { id: 1 };
map.set(userKey, { name: "Alice", age: 25 });
map.get(userKey); // { name: 'Alice', age: 25 }

// Using a function as a key
map.set(function () {}, "some value");

// Basic operations
map.set("key", "value");
map.get("key"); // 'value'
map.has("key"); // true
map.delete("key");
map.size; // size
```

```javascript
// Initialization
const map = new Map([
  ["name", "Alice"],
  ["age", 25],
  ["city", "New York"],
]);

// Iteration
for (const [key, value] of map) {
  console.log(key, value);
}

// Conversion
const obj = Object.fromEntries(map); // Map → object
const arr = [...map]; // Map → array
```

## When to Use Map Instead of an Object

```javascript
// Scenario: a cache that needs frequent add/delete operations
// With an object:
const cache = {};
cache[userId] = data;
delete cache[userId];
Object.keys(cache).length; // inefficient

// With a Map:
const cache = new Map();
cache.set(userId, data);
cache.delete(userId);
cache.size; // O(1)
```

```javascript
// Scenario: keys that are non-strings
// With an object: keys are toString()'d, different objects get the same key
const obj = {};
obj[{ id: 1 }] = "a";
obj[{ id: 2 }] = "b";
console.log(obj); // { '[object Object]': 'b' } — key was overwritten!

// With a Map: keys are references, they don't conflict
const map = new Map();
const key1 = { id: 1 };
const key2 = { id: 2 };
map.set(key1, "a");
map.set(key2, "b");
map.size; // 2, correct
```

## Summary

- `Set`: a collection of unique values; most useful for array deduplication and set operations
- `Map`: key-value pairs where keys can be any type; ideal for frequent add/delete or non-string keys
- For ordinary scenarios, objects and arrays are sufficient — don't use new APIs just for the sake of it
