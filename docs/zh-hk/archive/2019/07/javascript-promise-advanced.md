---
title: "JavaScript Promise 高級用法：落地路徑與實戰建議"
date: 2019-07-22 16:18:40
tags:
  - JavaScript
readingTime: 4
description: "日常開發中 `Promise` 的基礎用法（`.then`、`.catch`、`.finally`）已經很熟了，但實際項目中經常遇到一些進階場景：併發控製、超時處理、串行執行、全部完成（不管成功失敗）等。這篇文章整理了我在項目中積累的 Promise 高級用法。"
wordCount: 557
---

日常開發中 `Promise` 的基礎用法（`.then`、`.catch`、`.finally`）已經很熟了，但實際項目中經常遇到一些進階場景：併發控製、超時處理、串行執行、全部完成（不管成功失敗）等。這篇文章整理了我在項目中積累的 Promise 高級用法。

## Promise.all vs Promise.race

先回顧兩個基礎 API 的區別：

```javascript
// Promise.all：全部成功才成功，一個失敗就失敗
const results = await Promise.all([
  fetch('/api/users'),
  fetch('/api/orders'),
  fetch('/api/products')
])
// results 是三個響應的數組

// Promise.race：取最快完成的結果（無論成功失敗）
const result = await Promise.race([
  fetch('/api/data'),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 5000)
  )
])
```

## 實戰一：Promise.race 實現請求超時

```javascript
function fetchWithTimeout(url, options = {}, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`請求超時: ${url} (${timeout}ms)`))
      }, timeout)
    })
  ])
}

// 使用
try {
  const response = await fetchWithTimeout('/api/slow-endpoint', {}, 3000)
  const data = await response.json()
} catch (err) {
  console.error(err.message) // "請求超時: /api/slow-endpoint (3000ms)"
}
```

但上面的實現有個問題：即使超時了，原來的 fetch 請求仍然在後臺繼續執行（隻是我們不再等它了）。更好的做法是配合 `AbortController`（2019 年大部分現代瀏覽器已支援）：

```javascript
function fetchWithAbort(url, options = {}, timeout = 5000) {
  const controller = new AbortController()
  const signal = controller.signal

  const timeoutId = setTimeout(() => controller.abort(), timeout)

  return fetch(url, { ...options, signal })
    .then(response => {
      clearTimeout(timeoutId)
      return response
    })
    .catch(err => {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error(`請求超時: ${url}`)
      }
      throw err
    })
}
```

## 實戰二：Promise.allSettled（TC39 Stage 3）

`Promise.all` 有一個問題：任何一個 Promise 失敗，整個 `all` 就失敗了，無法獲取其他 Promise 的結果。`Promise.allSettled` 解決了這個問題——它等待所有 Promise 完成（無論成功失敗），然後返回每個 Promise 的狀態和結果。

```javascript
// 提案階段，2019 年還沒有原生支援，需要 polyfill
// Promise.allSettled polyfill
if (!Promise.allSettled) {
  Promise.allSettled = function(promises) {
    return Promise.all(
      promises.map(p =>
        Promise.resolve(p).then(
          value => ({ status: 'fulfilled', value }),
          reason => ({ status: 'rejected', reason })
        )
      )
    )
  }
}

// 使用
const results = await Promise.allSettled([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
])

// results:
// [
//   { status: 'fulfilled', value: [...] },
//   { status: 'fulfilled', value: [...] },
//   { status: 'rejected', reason: Error('...') }
// ]

// 分離成功和失敗
const successes = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

const failures = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason)
```

實際應用場景：批量刪除用户，部分可能因為權限不足而失敗，但不希望一個失敗影響其他操作：

```javascript
async function batchDeleteUsers(userIds) {
  const results = await Promise.allSettled(
    userIds.map(id => deleteUser(id))
  )

  const deleted = []
  const failed = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deleted.push(userIds[index])
    } else {
      failed.push({ id: userIds[index], error: result.reason.message })
    }
  })

  return { deleted, failed }
}
```

## 實戰三：併發控製

同時發 100 個請求？服務器會扛不住。需要控製併發數量：

```javascript
class ConcurrencyPool {
  constructor(concurrency = 6) {
    this.concurrency = concurrency
    this.running = 0
    this.queue = []
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this._run()
    })
  }

  _run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift()
      this.running++

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--
          this._run()
        })
    }
  }
}

// 使用
const pool = new ConcurrencyPool(3) // 最多同時 3 個請求

const urls = Array.from({ length: 20 }, (_, i) => `/api/item/${i}`)

const results = await Promise.all(
  urls.map(url =>
    pool.add(() => fetch(url).then(r => r.json()))
  )
)
```

更簡潔的實現（不需要類）：

```javascript
async function parallelLimit(tasks, concurrency) {
  const results = []
  const executing = new Set()

  for (const [index, task] of tasks.entries()) {
    const promise = Promise.resolve().then(() => task())
    results[index] = promise
    executing.add(promise)

    const cleanup = () => executing.delete(promise)
    promise.then(cleanup, cleanup)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}

// 使用
const results = await parallelLimit(
  urls.map(url => () => fetch(url).then(r => r.json())),
  3
)
```

## 實戰四：串行執行

有些場景必須串行——比如數據庫遷移、文件順序處理等：

```javascript
// 方式一：用 reduce
async function serial(tasks) {
  return tasks.reduce(
    (promise, task) => promise.then(result => task().then(r => [...result, r])),
    Promise.resolve([])
  )
}

// 方式二：用 for...of + await（更直觀）
async function serialFor(tasks) {
  const results = []
  for (const task of tasks) {
    results.push(await task())
  }
  return results
}

// 使用
const urls = ['/api/step1', '/api/step2', '/api/step3']

const results = await serialFor(
  urls.map(url => () => fetch(url).then(r => r.json()))
)
```

## 實戰五：手動實現 Promise.all

理解原理比會用更重要：

```javascript
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      return reject(new TypeError('參數必須是數組'))
    }

    const results = []
    let completedCount = 0
    const len = promises.length

    if (len === 0) {
      return resolve(results)
    }

    promises.forEach((promise, index) => {
      // 確保非 Promise 值也能處理
      Promise.resolve(promise)
        .then(value => {
          results[index] = value
          completedCount++

          if (completedCount === len) {
            resolve(results)
          }
        })
        .catch(reject) // 任何一個失敗，立即 reject
    })
  })
}

// 測試
const p1 = Promise.resolve(1)
const p2 = new Promise(resolve => setTimeout(() => resolve(2), 100))
const p3 = Promise.resolve(3)

const result = await promiseAll([p1, p2, p3])
console.log(result) // [1, 2, 3]
```

## 實戰六：retry 重試機製

網絡請求經常需要失敗重試：

```javascript
async function retry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err

      // 指數退避：每次重試等待時間翻倍
      const waitTime = delay * Math.pow(2, i)
      console.log(`第 ${i + 1} 次重試，等待 ${waitTime}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}

// 使用
const data = await retry(
  () => fetch('/api/unstable').then(r => r.json()),
  3,
  1000
)
```

## 踩坑記錄

### 坑 1：忘記 return Promise

```javascript
// 錯誤：.then 回調中沒有 return
getUser(id)
  .then(user => {
    getOrders(user.id) // 沒有 return！
  })
  .then(orders => {
    console.log(orders) // undefined
  })

// 正確
getUser(id)
  .then(user => {
    return getOrders(user.id)
  })
  .then(orders => {
    console.log(orders)
  })
```

### 坑 2：在 forEach 中使用 async/await

```javascript
// 錯誤：forEach 不會等待異步回調
const ids = [1, 2, 3]
ids.forEach(async (id) => {
  await deleteUser(id) // 併發執行，不是串行
})
console.log('刪除完成') // 不會等待上面的刪除操作

// 正確串行：
for (const id of ids) {
  await deleteUser(id)
}
console.log('刪除完成') // 會等待

// 正確併發（需要等待全部完成）：
await Promise.all(ids.map(id => deleteUser(id)))
```

### 坑 3：Promise 構造函數中的同步錯誤

```javascript
// 同步錯誤會被 Promise 捕獲
new Promise((resolve) => {
  JSON.parse('invalid json') // 同步拋出錯誤
  resolve()
}).catch(err => {
  console.error(err) // SyntaxError: Unexpected token
  // 這裏能捕獲到
})
```

### 坑 4：微任務執行時機

```javascript
console.log('start')

setTimeout(() => console.log('timeout'), 0)

Promise.resolve().then(() => console.log('promise'))

console.log('end')

// 輸出順序: start → end → promise → timeout
// Promise.then 是微任務，優先級高於 setTimeout（宏任務）
```

## 小結

- `Promise.race` 適合做超時控製，配合 `AbortController` 可以真正取消請求
- `Promise.allSettled` 適合批量操作中允許部分失敗的場景（需 polyfill）
- 併發控製是實際項目中的高頻需求，用隊列 + 計數器實現
- 串行執行用 `for...of` + `await` 最直觀
- 手寫 `Promise.all` 幫助理解原理：收集所有結果，計數器判斷全部完成
- 注意 `forEach` + async 的坑，它不會等待異步回調完成
