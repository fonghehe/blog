---
title: "JavaScript Deep Clone: Approaches and Tradeoffs"
date: 2018-03-17 11:08:16
tags:
  - JavaScript
readingTime: 2
description: "Deep cloning is a common frontend need, but there are many pitfalls in implementation. Here's a review of the approaches, their use cases, and limitations."
---

Deep cloning is a common frontend need, but there are many pitfalls in implementation. Here's a review of the approaches, their use cases, and limitations.

## Shallow Clone vs Deep Clone

```javascript
const obj = { name: "Alice", address: { city: "New York" } };

// Shallow clone: only copies the first level, nested references are the same
const shallow = { ...obj };
shallow.address.city = "London";
console.log(obj.address.city); // 'London' — the original was modified!

// Deep clone: completely independent, changes don't affect the original
const deep = deepClone(obj);
deep.address.city = "London";
console.log(obj.address.city); // 'New York' — original is unchanged
```

## Option 1: JSON Serialization

```javascript
const clone = JSON.parse(JSON.stringify(obj));
```

**Pros**: simple, one line of code

**Cons**:

- Can't handle `undefined`, functions, Symbol (they're dropped)
- Can't handle circular references (throws an error)
- `Date` objects become strings
- `NaN` and `Infinity` become `null`
- `RegExp` is not preserved

```javascript
const obj = {
  undef: undefined, // lost
  fn: () => {}, // lost
  date: new Date(), // becomes string "2018-03-17T..."
  regex: /test/g, // becomes empty object {}
  nan: NaN, // becomes null
};

const clone = JSON.parse(JSON.stringify(obj));
// { date: "2018-03-17T...", nan: null }
```

**Good for**: plain data objects (no special types), quick one-off usage.

## Option 2: Recursive Implementation

```javascript
function deepClone(source, cache = new WeakMap()) {
  // Return primitives directly
  if (source === null || typeof source !== "object") return source;

  // Handle circular references
  if (cache.has(source)) return cache.get(source);

  // Handle special types
  if (source instanceof Date) return new Date(source.getTime());
  if (source instanceof RegExp) return new RegExp(source.source, source.flags);

  // Create empty object/array
  const target = Array.isArray(source) ? [] : {};
  cache.set(source, target);

  // Recursively copy each property
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = deepClone(source[key], cache);
    }
  }

  return target;
}
```

Test:

```javascript
const original = {
  name: "Alice",
  address: { city: "New York" },
  hobbies: ["coding", "reading"],
  date: new Date(),
  regex: /test/g,
};

// Circular reference test
original.self = original;

const cloned = deepClone(original);
cloned.address.city = "London";

console.log(original.address.city); // 'New York' — unaffected
console.log(cloned.self === cloned); // true — circular reference correctly handled
console.log(cloned.date instanceof Date); // true
```

## Option 3: structuredClone (Modern Browsers)

Natively supported across browsers since 2022. Not available in 2018, but worth knowing:

```javascript
// Available in future (Chrome 98+, Firefox 94+, Node 17+)
const clone = structuredClone(obj);
```

Supports most types, but not functions or Symbol.

## Option 4: lodash.cloneDeep

The most reliable option for production:

```javascript
import cloneDeep from "lodash/cloneDeep";

const clone = cloneDeep(source);
```

lodash's implementation handles all edge cases — the most robust choice.

## How to Choose in Real Projects

| Scenario                              | Recommended                    |
| ------------------------------------- | ------------------------------ |
| Plain data object, quick usage        | `JSON.parse(JSON.stringify())` |
| Need to handle Date/RegExp            | lodash `cloneDeep`             |
| No dependencies, known data structure | Write your own recursive clone |
| Form reset, save initial value        | lodash `cloneDeep`             |

```javascript
// Form scenario: save initial value for reset
import cloneDeep from 'lodash/cloneDeep'

data() {
  return {
    form: { name: '', email: '' },
    originalForm: null
  }
},
created() {
  this.loadData()
},
methods: {
  async loadData() {
    const data = await fetchFormData()
    this.form = data
    this.originalForm = cloneDeep(data)  // save initial state
  },
  handleReset() {
    this.form = cloneDeep(this.originalForm)  // restore
  }
}
```

## Summary

- For simple cases use `JSON.parse(JSON.stringify())`, but understand its limitations
- For production code, `lodash/cloneDeep` is recommended — less worry
- For zero-dependency needs, write a recursive implementation and remember to handle circular references
