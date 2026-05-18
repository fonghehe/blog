---
title: "ES2020 新特性總結"
date: 2019-12-23 10:28:36
tags:
  - JavaScript
readingTime: 4
description: "TC-39 委員會每年都會給 JavaScript 帶來新特性。ES2020（ES11）已經走完了提案流程，預計 2020 年 6 月正式釋出。這次更新中有幾個非常實用的特性，特別是 Optional Chaining 和 Nullish Coalescing，能顯著減少我們日常程式碼中的防禦性判斷。下面逐一介紹。"
---

TC-39 委員會每年都會給 JavaScript 帶來新特性。ES2020（ES11）已經走完了提案流程，預計 2020 年 6 月正式釋出。這次更新中有幾個非常實用的特性，特別是 Optional Chaining 和 Nullish Coalescing，能顯著減少我們日常程式碼中的防禦性判斷。下面逐一介紹。

## Optional Chaining (?.)

Optional Chaining 可能是 ES2020 中最常用的特性。它允許在訪問深層巢狀物件屬性時，如果中間某個屬性為 `null` 或 `undefined`，直接返回 `undefined` 而不是報錯。

```javascript
// 以前的寫法：層層判斷
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

// 適用場景一：訪問深層屬性
const user = {
  name: '張三',
  address: {
    city: '北京'
  }
}

console.log(user?.address?.city)      // '北京'
console.log(user?.company?.name)      // undefined（不報錯）
console.log(user?.['address']?.city)  // '北京'（支援括號訪問）

// 適用場景二：呼叫可能不存在的方法
const api = {
  getData() { return { items: [1, 2, 3] } }
}

const data = api?.getData?.()   // { items: [1, 2, 3] }
const missing = api?.missing?.() // undefined（不報錯）

// 適用場景三：訪問陣列元素
const arr = [1, 2, 3]
console.log(arr?.[0])  // 1

const empty = null
console.log(empty?.[0]) // undefined

// 實際專案中的應用：API 響應處理
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()

  // 不再需要冗長的判斷
  const userName = data?.result?.user?.name ?? '未知使用者'
  const avatar = data?.result?.user?.profile?.avatar ?? '/default-avatar.png'

  return { userName, avatar }
}
```

## Nullish Coalescing (??)

Nullish Coalescing 運算子 `??` 與 `||` 類似，但只在左側為 `null` 或 `undefined` 時才返回右側值。這個區別在處理 `0`、`''`、`false` 等 falsy 值時非常重要：

```javascript
// || 的問題：會把所有 falsy 值都替換掉
const count = 0
console.log(count || 10)  // 10（0 被當作"假值"替換了）

const name = ''
console.log(name || '預設名稱')  // '預設名稱'（空字串被替換了）

const enabled = false
console.log(enabled || true)  // true（false 被替換了）

// ?? 只在 null/undefined 時替換
console.log(count ?? 10)       // 0（0 被保留）
console.log(name ?? '預設名稱') // ''（空字串被保留）
console.log(enabled ?? true)   // false（false 被保留）

console.log(null ?? 'fallback')      // 'fallback'
console.log(undefined ?? 'fallback') // 'fallback'

// 組合使用 Optional Chaining + Nullish Coalescing
const config = {
  server: {
    port: 0  // 顯式設定埠為 0
  }
}

// 用 || 的話，port:0 會被錯誤地替換
const port1 = config?.server?.port || 3000  // 3000（錯誤！）

// 用 ?? 正確保留 0
const port2 = config?.server?.port ?? 3000  // 0（正確）

// 實際專案：表單預設值處理
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

BigInt 是 JavaScript 新增的基本資料型別，用於表示任意精度的整數。它解決了 `Number.MAX_SAFE_INTEGER` (2^53 - 1) 的限制：

```javascript
// Number 的精度限制
console.log(Number.MAX_SAFE_INTEGER)  // 9007199254740991
console.log(9007199254740991 + 1)     // 9007199254740992
console.log(9007199254740991 + 2)     // 9007199254740992（精度丟失！）

// BigInt：通過數字後加 n 建立
const bigNum = 9007199254740991n
console.log(bigNum + 1n)  // 9007199254740992n（正確）
console.log(bigNum + 2n)  // 9007199254740993n（正確）

// 或通過 BigInt() 函式建立
const another = BigInt('9007199254740991999999999999')

// 基本運算
console.log(100n + 200n)    // 300n
console.log(100n * 200n)    // 20000n
console.log(100n / 30n)     // 3n（整數除法，捨去小數）
console.log(100n % 30n)     // 10n

// 注意：BigInt 和 Number 不能混合運算
// console.log(100n + 200)  // TypeError
console.log(100n + BigInt(200))  // 300n（需要顯式轉換）

// 比較運算可以混合
console.log(100n > 50)    // true
console.log(100n === 100) // false（型別不同）
console.log(100n == 100)  // true（值相等）

// 實際應用場景：資料庫 ID、金融計算
const userId = 1589328472619638784n  // Twitter Snowflake ID
const transactionId = 2019122300000000001n
```

## Promise.allSettled

`Promise.all` 在任何一個 Promise reject 時就會立即 reject。`Promise.allSettled` 則會等待所有 Promise 完成（無論成功還是失敗），返回每個 Promise 的結果狀態：

```javascript
// Promise.all 的問題：一個失敗就全部失敗
const promises = [
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
]

try {
  const results = await Promise.all(promises)
  // 如果 orders 請求失敗，這裡拿不到 users 和 products 的資料
} catch (error) {
  console.log(error) // 只知道有一個失敗了，不知道是哪個
}

// Promise.allSettled：每個結果都有狀態
const results = await Promise.allSettled([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
])

// results 結構：
// [
//   { status: 'fulfilled', value: [...] },
//   { status: 'rejected', reason: Error('network error') },
//   { status: 'fulfilled', value: [...] }
// ]

// 方便地分離成功和失敗的結果
const succeeded = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason)

console.log('成功的請求:', succeeded)
console.log('失敗的請求:', failed)

// 實際應用：批次操作，部分失敗不影響其他
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

不同 JavaScript 環境中，全域性物件的名稱不同。`globalThis` 提供了一個統一的方式訪問全域性物件：

```javascript
// 以前：需要判斷環境
function getGlobalObject() {
  if (typeof window !== 'undefined') return window        // 瀏覽器
  if (typeof global !== 'undefined') return global        // Node.js
  if (typeof self !== 'undefined') return self            // Web Worker
  throw new Error('無法確定全域性物件')
}

// ES2020：直接用 globalThis
console.log(globalThis)  // 在瀏覽器中是 window，在 Node.js 中是 global

// 實際應用：跨環境的全域性變數儲存
globalThis.__APP_CONFIG__ = {
  version: '1.0.0',
  env: 'production'
}

// 任何地方都可以訪問
console.log(globalThis.__APP_CONFIG__)

// polyfill（如果需要支援舊環境）
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

動態 `import()` 允許在執行時按需載入模組，是程式碼分割的基礎：

```javascript
// 靜態匯入：在檔案頂部，編譯時確定
import { debounce } from 'lodash'

// 動態匯入：在程式碼中按條件載入，執行時決定
async function loadChart() {
  // 只有使用者點選"檢視圖表"時才載入 chart.js
  const chartModule = await import('chart.js')
  const Chart = chartModule.default

  const ctx = document.getElementById('myChart').getContext('2d')
  new Chart(ctx, { type: 'bar', data: chartData })
}

// 配合 React.lazy 實現路由級程式碼分割
import React, { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))

// 按條件載入模組
async function getParser(format) {
  switch (format) {
    case 'csv':
      return await import('./parsers/csv')
    case 'json':
      return await import('./parsers/json')
    case 'xml':
      return await import('./parsers/xml')
    default:
      throw new Error(`不支援的格式: ${format}`)
  }
}

// 預載入：提前下載但不執行
function preloadChart() {
  // link prefetch 或者 webpack magic comments
  import(/* webpackPrefetch: true */ 'chart.js')
}

// 錯誤處理
async function safeImport(modulePath) {
  try {
    const module = await import(modulePath)
    return module
  } catch (error) {
    console.error(`載入模組失敗: ${modulePath}`, error)
    return null
  }
}
```

## 語法示例彙總

```javascript
// ES2020 全部新特性速覽

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

// 8. import.meta（獲取模組元資訊）
console.log(import.meta.url)  // 當前模組的 URL
```

## 小結

- Optional Chaining (?.) 讓深層屬性訪問不再需要層層判斷，是最實用的新特性
- Nullish Coalescing (??) 解決了 || 運算子誤替換 falsy 值的問題
- BigInt 解決了大整數精度丟失的問題，適用於 ID、金融等場景
- Promise.allSettled 讓批次非同步操作的結果處理更靈活，不再"一個失敗全掛"
- globalThis 統一了不同環境的全域性物件訪問方式
- Dynamic import() 是程式碼分割和按需載入的基礎，配合 React.lazy 使用效果最佳
- 這些特性在 TypeScript 3.7+ 中已經得到支援，可以提前使用
