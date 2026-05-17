---
title: "ES2020新機能まとめ"
date: 2019-12-23 10:28:36
tags:
  - JavaScript
readingTime: 4
description: "TC-39 委员会每年都会给 JavaScript 带来新特性。ES2020（ES11）已经走完了提案流程，预计 2020 年 6 月正式发布。这次更新中有几个非常实用的特性，特别是 Optional Chaining 和 Nullish Coalescing，能显著减少我们日常代码中的防御性判断。下面逐一介绍。"
---

TC-39 委员会每年都会给 JavaScript 带来新特性。ES2020（ES11）已经走完了提案流程，预计 2020 年 6 月正式发布。这次更新中有几个非常实用的特性，特别是 Optional Chaining 和 Nullish Coalescing，能显著减少我们日常代码中的防御性判断。下面逐一介绍。

## オプショナルチェーン (?.)

Optional Chaining 可能是 ES2020 中最常用的特性。它允许在访问深层嵌套对象属性时，如果中间某个属性为 `null` 或 `undefined`，直接返回 `undefined` 而不是报错。

```javascript
// 以前的写法：层层判断
function getCity(user) {
  if (user && user.address && user.address.city) {
    return user.address.city
  }
  return undefined
}

// 使用 Optional Chaining
function getCity(user) {
  return user?.address?.city
}

// 适用场景一：访问深层属性
const user = {
  name: '张三',
  address: {
    city: '北京'
  }
}

console.log(user?.address?.city)      // '北京'
console.log(user?.company?.name)      // undefined（不报错）
console.log(user?.['address']?.city)  // '北京'（支持括号访问）

// 适用场景二：调用可能不存在的方法
const api = {
  getData() { return { items: [1, 2, 3] } }
}

const data = api?.getData?.()   // { items: [1, 2, 3] }
const missing = api?.missing?.() // undefined（不报错）

// 适用场景三：访问数组元素
const arr = [1, 2, 3]
console.log(arr?.[0])  // 1

const empty = null
console.log(empty?.[0]) // undefined

// 实际项目中的应用：API 响应处理
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()

  // 不再需要冗长的判断
  const userName = data?.result?.user?.name ?? '未知用户'
  const avatar = data?.result?.user?.profile?.avatar ?? '/default-avatar.png'

  return { userName, avatar }
}
```

## Null合体演算子 (??)

Nullish Coalescing 运算符 `??` 与 `||` 类似，但只在左侧为 `null` 或 `undefined` 时才返回右侧值。这个区别在处理 `0`、`''`、`false` 等 falsy 值时非常重要：

```javascript
// || 的问题：会把所有 falsy 值都替换掉
const count = 0
console.log(count || 10)  // 10（0 被当作"假值"替换了）

const name = ''
console.log(name || '默认名称')  // '默认名称'（空字符串被替换了）

const enabled = false
console.log(enabled || true)  // true（false 被替换了）

// ?? 只在 null/undefined 时替换
console.log(count ?? 10)       // 0（0 被保留）
console.log(name ?? '默认名称') // ''（空字符串被保留）
console.log(enabled ?? true)   // false（false 被保留）

console.log(null ?? 'fallback')      // 'fallback'
console.log(undefined ?? 'fallback') // 'fallback'

// 组合使用 Optional Chaining + Nullish Coalescing
const config = {
  server: {
    port: 0  // 显式设置端口为 0
  }
}

// 用 || 的话，port:0 会被错误地替换
const port1 = config?.server?.port || 3000  // 3000（错误！）

// 用 ?? 正确保留 0
const port2 = config?.server?.port ?? 3000  // 0（正确）

// 实际项目：表单默认值处理
function getFormValues(formData) {
  return {
    username: formData?.username ?? '',
    age: formData?.age ?? 0,
    enabled: formData?.enabled ?? false,
    tags: formData?.tags ?? []
  }
}
```

## BigInt

BigInt 是 JavaScript 新增的基本数据类型，用于表示任意精度的整数。它解决了 `Number.MAX_SAFE_INTEGER` (2^53 - 1) 的限制：

```javascript
// Number 的精度限制
console.log(Number.MAX_SAFE_INTEGER)  // 9007199254740991
console.log(9007199254740991 + 1)     // 9007199254740992
console.log(9007199254740991 + 2)     // 9007199254740992（精度丢失！）

// BigInt：通过数字后加 n 创建
const bigNum = 9007199254740991n
console.log(bigNum + 1n)  // 9007199254740992n（正确）
console.log(bigNum + 2n)  // 9007199254740993n（正确）

// 或通过 BigInt() 函数创建
const another = BigInt('9007199254740991999999999999')

// 基本运算
console.log(100n + 200n)    // 300n
console.log(100n * 200n)    // 20000n
console.log(100n / 30n)     // 3n（整数除法，舍去小数）
console.log(100n % 30n)     // 10n

// 注意：BigInt 和 Number 不能混合运算
// console.log(100n + 200)  // TypeError
console.log(100n + BigInt(200))  // 300n（需要显式转换）

// 比较运算可以混合
console.log(100n > 50)    // true
console.log(100n === 100) // false（类型不同）
console.log(100n == 100)  // true（值相等）

// 实际应用场景：数据库 ID、金融计算
const userId = 1589328472619638784n  // Twitter Snowflake ID
const transactionId = 2019122300000000001n
```

## Promise.allSettled

`Promise.all` 在任何一个 Promise reject 时就会立即 reject。`Promise.allSettled` 则会等待所有 Promise 完成（无论成功还是失败），返回每个 Promise 的结果状态：

```javascript
// Promise.all 的问题：一个失败就全部失败
const promises = [
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
]

try {
  const results = await Promise.all(promises)
  // 如果 orders 请求失败，这里拿不到 users 和 products 的数据
} catch (error) {
  console.log(error) // 只知道有一个失败了，不知道是哪个
}

// Promise.allSettled：每个结果都有状态
const results = await Promise.allSettled([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
])

// results 结构：
// [
//   { status: 'fulfilled', value: [...] },
//   { status: 'rejected', reason: Error('network error') },
//   { status: 'fulfilled', value: [...] }
// ]

// 方便地分离成功和失败的结果
const succeeded = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason)

console.log('成功的请求:', succeeded)
console.log('失败的请求:', failed)

// 实际应用：批量操作，部分失败不影响其他
async function batchDelete(ids) {
  const results = await Promise.allSettled(
    ids.map(id => fetch(`/api/items/${id}`, { method: 'DELETE' }))
  )

  const deleted = []
  const errors = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deleted.push(ids[index])
    } else {
      errors.push({ id: ids[index], error: result.reason })
    }
  })

  return { deleted, errors }
}
```

## globalThis

不同 JavaScript 环境中，全局对象的名称不同。`globalThis` 提供了一个统一的方式访问全局对象：

```javascript
// 以前：需要判断环境
function getGlobalObject() {
  if (typeof window !== 'undefined') return window        // 浏览器
  if (typeof global !== 'undefined') return global        // Node.js
  if (typeof self !== 'undefined') return self            // Web Worker
  throw new Error('无法确定全局对象')
}

// ES2020：直接用 globalThis
console.log(globalThis)  // 在浏览器中是 window，在 Node.js 中是 global

// 实际应用：跨环境的全局变量存储
globalThis.__APP_CONFIG__ = {
  version: '1.0.0',
  env: 'production'
}

// 任何地方都可以访问
console.log(globalThis.__APP_CONFIG__)

// polyfill（如果需要支持旧环境）
if (typeof globalThis === 'undefined') {
  (function() {
    if (typeof window !== 'undefined') {
      window.globalThis = window
    } else if (typeof global !== 'undefined') {
      global.globalThis = global
    } else if (typeof self !== 'undefined') {
      self.globalThis = self
    }
  })()
}
```

## Dynamic Import

动态 `import()` 允许在运行时按需加载模块，是代码分割的基础：

```javascript
// 静态导入：在文件顶部，编译时确定
import { debounce } from 'lodash'

// 动态导入：在代码中按条件加载，运行时决定
async function loadChart() {
  // 只有用户点击"查看图表"时才加载 chart.js
  const chartModule = await import('chart.js')
  const Chart = chartModule.default

  const ctx = document.getElementById('myChart').getContext('2d')
  new Chart(ctx, { type: 'bar', data: chartData })
}

// 配合 React.lazy 实现路由级代码分割
import React, { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))

// 按条件加载模块
async function getParser(format) {
  switch (format) {
    case 'csv':
      return await import('./parsers/csv')
    case 'json':
      return await import('./parsers/json')
    case 'xml':
      return await import('./parsers/xml')
    default:
      throw new Error(`不支持的格式: ${format}`)
  }
}

// 预加载：提前下载但不执行
function preloadChart() {
  // link prefetch 或者 webpack magic comments
  import(/* webpackPrefetch: true */ 'chart.js')
}

// 错误处理
async function safeImport(modulePath) {
  try {
    const module = await import(modulePath)
    return module
  } catch (error) {
    console.error(`加载模块失败: ${modulePath}`, error)
    return null
  }
}
```

## 構文例のまとめ

```javascript
// ES2020 全部新特性速览

// 1. Optional Chaining
const value = obj?.prop?.nested

// 2. Nullish Coalescing
const result = maybeNull ?? 'default'

// 3. BigInt
const big = 9007199254740993n

// 4. Promise.allSettled
const outcomes = await Promise.allSettled([p1, p2, p3])

// 5. globalThis
const global = globalThis

// 6. Dynamic Import
const mod = await import('./module')

// 7. String.prototype.matchAll（也是 ES2020 的）
const regex = /t(e)(st(\d?))/g
const str = 'test1test2'
const matches = [...str.matchAll(regex)]
// [['test1', 'e', 'st1'], ['test2', 'e', 'st2']]

// 8. import.meta（获取模块元信息）
console.log(import.meta.url)  // 当前模块的 URL
```

## まとめ

- Optional Chaining (?.) 让深层属性访问不再需要层层判断，是最实用的新特性
- Nullish Coalescing (??) 解决了 || 运算符误替换 falsy 值的问题
- BigInt 解决了大整数精度丢失的问题，适用于 ID、金融等场景
- Promise.allSettled 让批量异步操作的结果处理更灵活，不再"一个失败全挂"
- globalThis 统一了不同环境的全局对象访问方式
- Dynamic import() 是代码分割和按需加载的基础，配合 React.lazy 使用效果最佳
- 这些特性在 TypeScript 3.7+ 中已经得到支持，可以提前使用
