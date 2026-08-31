---
title: "ES2021 New Features: A Pragmatic Update"
date: 2021-07-28 15:09:57
tags:
  - JavaScript

readingTime: 2
description: "TC39 officially released the ES2021 standard in June 2021. Compared with heavyweight features like ES2020's `Optional Chaining` and `Nullish Coalescing`, the ES2021 updates lean toward pragmatism — each feature is small, but genuinely useful when you're writing code."
wordCount: 243
---

TC39 officially released the ES2021 standard in June 2021. Compared with heavyweight features like ES2020's `Optional Chaining` and `Nullish Coalescing`, the ES2021 updates lean toward pragmatism — each feature is small, but genuinely useful when you're writing code.

## String.prototype.replaceAll

You no longer have to reach for a regex or `split().join()`:

```javascript
// 以前的写法
const text = 'hello world, hello everyone'
const result1 = text.replace(/hello/g, 'hi')       // 需要正则
const result2 = text.split('hello').join('hi')       // 不够直观

// ES2021
const result3 = text.replaceAll('hello', 'hi')
// 'hi world, hi everyone'

// 注意：第一个参数是正则时不加 g 标志会报错
text.replaceAll(/hello/g, 'hi')  // OK
text.replaceAll(/hello/, 'hi')   // TypeError
```

## Promise.any

The opposite of `Promise.all`, `Promise.any` resolves as soon as the first promise fulfills:

```javascript
const promises = [
  fetch('/api/cache-server').then(r => r.json()),    // 可能超时
  fetch('/api/cdn-server').then(r => r.json()),      // 比较快
  fetch('/api/origin-server').then(r => r.json())    // 最慢
]

// 只要有一个成功就返回
const fastest = await Promise.any(promises)
console.log('最快返回的数据:', fastest)

// 全部失败才 reject，抛出 AggregateError
try {
  await Promise.any([
    Promise.reject('error 1'),
    Promise.reject('error 2')
  ])
} catch (err) {
  console.log(err.errors) // ['error 1', 'error 2']
}
```

The difference from `Promise.race`: `race` returns on the first settled promise (regardless of success or failure), while `any` returns only on the first fulfilled one (it only cares about success).

Real-world scenarios: competing across multiple CDN sources, or falling back between multiple data sources.

## Logical Assignment Operators

Three new compound assignment operators that simplify conditional assignment:

```javascript
// ||=  等价于 x = x || y（假值时赋值）
let config = {}
config.timeout ||= 3000
// 如果 config.timeout 是假值，赋值为 3000

// &&=  等价于 x = x && y（真值时赋值）
let user = { name: '张三' }
user.name &&= user.name.toUpperCase()
// user.name 是真值，执行赋值

// ??=  等价于 x = x ?? y（null/undefined 时赋值）
let settings = { theme: null }
settings.theme ??= 'dark'
// theme 是 null，赋值为 'dark'

// 对比
settings.theme = settings.theme || 'dark' // 会覆盖 0, '' 等假值
settings.theme ??= 'dark'                 // 只覆盖 null 和 undefined
```

They're especially handy when merging configurations or setting default values.

## WeakRef and FinalizationRegistry

`WeakRef` lets you create a weak reference to an object without preventing the GC from reclaiming it:

```javascript
let cache = new Map()

function getCachedData(key) {
  const ref = cache.get(key)
  if (ref) {
    const data = ref.deref()
    if (data) return data
  }

  // 缓存不存在或已被 GC，重新加载
  const data = loadFromServer(key)
  cache.set(key, new WeakRef(data))
  return data
}

// 配合 FinalizationRegistry 清理
const registry = new FinalizationRegistry((key) => {
  console.log(`${key} 的缓存已被 GC 回收`)
  cache.delete(key)
})

function cacheData(key, data) {
  cache.set(key, new WeakRef(data))
  registry.register(data, key)
}
```

This feature is mainly for memory-sensitive caching scenarios; it rarely comes up in day-to-day application development.

## Numeric Separators

Pure syntactic sugar that makes large numbers easier to read:

```javascript
const billion = 1_000_000_000
const bytes = 0xFF_FF_FF_FF
const binary = 0b1111_0000_0000
const creditCard = '4916_1234_5678_9012'

// 可以随意分组
const price = 99_999.99
const maxInt = 9_007_199_254_740_991
```

## Summary

- `replaceAll` solves the long-standing pain of string replacement.
- `Promise.any` fills the last gap in the Promise combinators.
- The logical assignment operators make conditional assignment more concise, with `??=` being the most useful.
- `WeakRef` covers a fairly niche scenario that most applications don't need.
- Numeric separators are a pure readability win.
- All of these features are fully supported in Node.js 16 and every modern browser.