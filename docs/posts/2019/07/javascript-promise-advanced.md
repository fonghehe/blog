---
title: "JavaScript Promise 高级用法"
date: 2019-07-22 16:18:40
tags:
  - JavaScript
---

日常开发中 `Promise` 的基础用法（`.then`、`.catch`、`.finally`）已经很熟了，但实际项目中经常遇到一些进阶场景：并发控制、超时处理、串行执行、全部完成（不管成功失败）等。这篇文章整理了我在项目中积累的 Promise 高级用法。

## Promise.all vs Promise.race

先回顾两个基础 API 的区别：

```javascript
// Promise.all：全部成功才成功，一个失败就失败
const results = await Promise.all([
  fetch('/api/users'),
  fetch('/api/orders'),
  fetch('/api/products')
])
// results 是三个响应的数组

// Promise.race：取最快完成的结果（无论成功失败）
const result = await Promise.race([
  fetch('/api/data'),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 5000)
  )
])
```

## 实战一：Promise.race 实现请求超时

```javascript
function fetchWithTimeout(url, options = {}, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`请求超时: ${url} (${timeout}ms)`))
      }, timeout)
    })
  ])
}

// 使用
try {
  const response = await fetchWithTimeout('/api/slow-endpoint', {}, 3000)
  const data = await response.json()
} catch (err) {
  console.error(err.message) // "请求超时: /api/slow-endpoint (3000ms)"
}
```

但上面的实现有个问题：即使超时了，原来的 fetch 请求仍然在后台继续执行（只是我们不再等它了）。更好的做法是配合 `AbortController`（2019 年大部分现代浏览器已支持）：

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
        throw new Error(`请求超时: ${url}`)
      }
      throw err
    })
}
```

## 实战二：Promise.allSettled（TC39 Stage 3）

`Promise.all` 有一个问题：任何一个 Promise 失败，整个 `all` 就失败了，无法获取其他 Promise 的结果。`Promise.allSettled` 解决了这个问题——它等待所有 Promise 完成（无论成功失败），然后返回每个 Promise 的状态和结果。

```javascript
// 提案阶段，2019 年还没有原生支持，需要 polyfill
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

// 分离成功和失败
const successes = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

const failures = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason)
```

实际应用场景：批量删除用户，部分可能因为权限不足而失败，但不希望一个失败影响其他操作：

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

## 实战三：并发控制

同时发 100 个请求？服务器会扛不住。需要控制并发数量：

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
const pool = new ConcurrencyPool(3) // 最多同时 3 个请求

const urls = Array.from({ length: 20 }, (_, i) => `/api/item/${i}`)

const results = await Promise.all(
  urls.map(url =>
    pool.add(() => fetch(url).then(r => r.json()))
  )
)
```

更简洁的实现（不需要类）：

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

## 实战四：串行执行

有些场景必须串行——比如数据库迁移、文件顺序处理等：

```javascript
// 方式一：用 reduce
async function serial(tasks) {
  return tasks.reduce(
    (promise, task) => promise.then(result => task().then(r => [...result, r])),
    Promise.resolve([])
  )
}

// 方式二：用 for...of + await（更直观）
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

## 实战五：手动实现 Promise.all

理解原理比会用更重要：

```javascript
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      return reject(new TypeError('参数必须是数组'))
    }

    const results = []
    let completedCount = 0
    const len = promises.length

    if (len === 0) {
      return resolve(results)
    }

    promises.forEach((promise, index) => {
      // 确保非 Promise 值也能处理
      Promise.resolve(promise)
        .then(value => {
          results[index] = value
          completedCount++

          if (completedCount === len) {
            resolve(results)
          }
        })
        .catch(reject) // 任何一个失败，立即 reject
    })
  })
}

// 测试
const p1 = Promise.resolve(1)
const p2 = new Promise(resolve => setTimeout(() => resolve(2), 100))
const p3 = Promise.resolve(3)

const result = await promiseAll([p1, p2, p3])
console.log(result) // [1, 2, 3]
```

## 实战六：retry 重试机制

网络请求经常需要失败重试：

```javascript
async function retry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err

      // 指数退避：每次重试等待时间翻倍
      const waitTime = delay * Math.pow(2, i)
      console.log(`第 ${i + 1} 次重试，等待 ${waitTime}ms`)
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

## 踩坑记录

### 坑 1：忘记 return Promise

```javascript
// 错误：.then 回调中没有 return
getUser(id)
  .then(user => {
    getOrders(user.id) // 没有 return！
  })
  .then(orders => {
    console.log(orders) // undefined
  })

// 正确
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
// 错误：forEach 不会等待异步回调
const ids = [1, 2, 3]
ids.forEach(async (id) => {
  await deleteUser(id) // 并发执行，不是串行
})
console.log('删除完成') // 不会等待上面的删除操作

// 正确串行：
for (const id of ids) {
  await deleteUser(id)
}
console.log('删除完成') // 会等待

// 正确并发（需要等待全部完成）：
await Promise.all(ids.map(id => deleteUser(id)))
```

### 坑 3：Promise 构造函数中的同步错误

```javascript
// 同步错误会被 Promise 捕获
new Promise((resolve) => {
  JSON.parse('invalid json') // 同步抛出错误
  resolve()
}).catch(err => {
  console.error(err) // SyntaxError: Unexpected token
  // 这里能捕获到
})
```

### 坑 4：微任务执行时机

```javascript
console.log('start')

setTimeout(() => console.log('timeout'), 0)

Promise.resolve().then(() => console.log('promise'))

console.log('end')

// 输出顺序: start → end → promise → timeout
// Promise.then 是微任务，优先级高于 setTimeout（宏任务）
```

## 小结

- `Promise.race` 适合做超时控制，配合 `AbortController` 可以真正取消请求
- `Promise.allSettled` 适合批量操作中允许部分失败的场景（需 polyfill）
- 并发控制是实际项目中的高频需求，用队列 + 计数器实现
- 串行执行用 `for...of` + `await` 最直观
- 手写 `Promise.all` 帮助理解原理：收集所有结果，计数器判断全部完成
- 注意 `forEach` + async 的坑，它不会等待异步回调完成
