---
title: "ES2021 新特性：實用主義的更新"
date: 2021-07-28 15:09:57
tags:
  - 前端
  - JavaScript
readingTime: 2
description: "TC39 在 2021 年 6 月正式發佈了 ES2021 標準。和 ES2020 的 `Optional Chaining`、`Nullish Coalescing` 這種重磅特性相比，ES2021 的更新更偏向實用主義——每個特性都不大，但寫代碼時確實用得上。"
wordCount: 348
---

TC39 在 2021 年 6 月正式發佈了 ES2021 標準。和 ES2020 的 `Optional Chaining`、`Nullish Coalescing` 這種重磅特性相比，ES2021 的更新更偏向實用主義——每個特性都不大，但寫代碼時確實用得上。

## String.prototype.replaceAll

終於不用再寫正則或者 `split().join()` 了：

```javascript
// 以前的寫法
const text = 'hello world, hello everyone'
const result1 = text.replace(/hello/g, 'hi')       // 需要正則
const result2 = text.split('hello').join('hi')       // 不夠直觀

// ES2021
const result3 = text.replaceAll('hello', 'hi')
// 'hi world, hi everyone'

// 注意：第一個參數是正則時不加 g 標誌會報錯
text.replaceAll(/hello/g, 'hi')  // OK
text.replaceAll(/hello/, 'hi')   // TypeError
```

## Promise.any

和 `Promise.all` 相反，`Promise.any` 在第一個 Promise fulfilled 時就 resolve：

```javascript
const promises = [
  fetch('/api/cache-server').then(r => r.json()),    // 可能超時
  fetch('/api/cdn-server').then(r => r.json()),      // 比較快
  fetch('/api/origin-server').then(r => r.json())    // 最慢
]

// 只要有一個成功就返回
const fastest = await Promise.any(promises)
console.log('最快返回的數據:', fastest)

// 全部失敗才 reject，拋出 AggregateError
try {
  await Promise.any([
    Promise.reject('error 1'),
    Promise.reject('error 2')
  ])
} catch (err) {
  console.log(err.errors) // ['error 1', 'error 2']
}
```

和 `Promise.race` 的區別：`race` 是第一個 settled（不管成功失敗）就返回，`any` 是第一個 fulfilled（只看成功）才返回。

實際場景：多 CDN 源競爭、多數據源降級。

## 邏輯賦值運算符

三個新的複合賦值運算符，簡化條件賦值：

```javascript
// ||=  等價於 x = x || y（假值時賦值）
let config = {}
config.timeout ||= 3000
// 如果 config.timeout 是假值，賦值為 3000

// &&=  等價於 x = x && y（真值時賦值）
let user = { name: '張三' }
user.name &&= user.name.toUpperCase()
// user.name 是真值，執行賦值

// ??=  等價於 x = x ?? y（null/undefined 時賦值）
let settings = { theme: null }
settings.theme ??= 'dark'
// theme 是 null，賦值為 'dark'

// 對比
settings.theme = settings.theme || 'dark' // 會覆蓋 0, '' 等假值
settings.theme ??= 'dark'                 // 只覆蓋 null 和 undefined
```

在處理配置合併、默認值設置時特別好用。

## WeakRef 和 FinalizationRegistry

`WeakRef` 允許創建對象的弱引用，不阻止 GC 回收：

```javascript
let cache = new Map()

function getCachedData(key) {
  const ref = cache.get(key)
  if (ref) {
    const data = ref.deref()
    if (data) return data
  }

  // 緩存不存在或已被 GC，重新加載
  const data = loadFromServer(key)
  cache.set(key, new WeakRef(data))
  return data
}

// 配合 FinalizationRegistry 清理
const registry = new FinalizationRegistry((key) => {
  console.log(`${key} 的緩存已被 GC 回收`)
  cache.delete(key)
})

function cacheData(key, data) {
  cache.set(key, new WeakRef(data))
  registry.register(data, key)
}
```

這個特性主要用於內存敏感的緩存場景，日常業務開發用得不多。

## 數字分隔符

純粹的語法糖，讓大數字更易讀：

```javascript
const billion = 1_000_000_000
const bytes = 0xFF_FF_FF_FF
const binary = 0b1111_0000_0000
const creditCard = '4916_1234_5678_9012'

// 可以隨意分組
const price = 99_999.99
const maxInt = 9_007_199_254_740_991
```

## 小結

- `replaceAll` 解決了字符串替換的老痛點
- `Promise.any` 填補了 Promise 組合方法的最後一塊拼圖
- 邏輯賦值運算符讓條件賦值更簡潔，`??=` 最實用
- `WeakRef` 場景較特殊，大部分業務不需要
- 數字分隔符是純粹的可讀性提升
- 這些特性在 Node.js 16 和所有現代瀏覽器中已全面支持