---
title: "ES2021 新機能：実用主義的な更新"
date: 2021-07-28 15:09:57
tags:
  - JavaScript

readingTime: 2
description: "TC39 在 2021 年 6 月正式发布了 ES2021 标准。和 ES2020 的 `Optional Chaining`、`Nullish Coalescing` 这种重磅特性相比，ES2021 的更新更偏向实用主义——每个特性都不大，但写代码时确实用得上。"
---

TC39 在 2021 年 6 月正式发布了 ES2021 标准。和 ES2020 的 `Optional Chaining`、`Nullish Coalescing` 这种重磅特性相比，ES2021 的更新更偏向实用主义——每个特性都不大，但写代码时确实用得上。

## String.prototype.replaceAll

终于不用再写正则或者 `split().join()` 了：

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

和 `Promise.all` 相反，`Promise.any` 在第一个 Promise fulfilled 时就 resolve：

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

和 `Promise.race` 的区别：`race` 是第一个 settled（不管成功失败）就返回，`any` 是第一个 fulfilled（只看成功）才返回。

实际场景：多 CDN 源竞争、多数据源降级。

## 論理代入演算子

三个新的复合赋值运算符，简化条件赋值：

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

在处理配置合并、默认值设置时特别好用。

## WeakRef 和 FinalizationRegistry

`WeakRef` 允许创建对象的弱引用，不阻止 GC 回收：

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

这个特性主要用于内存敏感的缓存场景，日常业务开发用得不多。

## 数値セパレーター

纯粹的语法糖，让大数字更易读：

```javascript
const billion = 1_000_000_000
const bytes = 0xFF_FF_FF_FF
const binary = 0b1111_0000_0000
const creditCard = '4916_1234_5678_9012'

// 可以随意分组
const price = 99_999.99
const maxInt = 9_007_199_254_740_991
```

## まとめ

- `replaceAll` 解决了字符串替换的老痛点
- `Promise.any` 填补了 Promise 组合方法的最后一块拼图
- 逻辑赋值运算符让条件赋值更简洁，`??=` 最实用
- `WeakRef` 场景较特殊，大部分业务不需要
- 数字分隔符是纯粹的可读性提升
- 这些特性在 Node.js 16 和所有现代浏览器中已全面支持