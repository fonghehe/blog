---
title: "前端效能最佳化手段彙總"
date: 2019-03-11 10:41:26
tags:
  - 前端
readingTime: 1
description: "在團隊推廣前端效能最佳化手段彙總的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
wordCount: 230
---

在團隊推廣前端效能最佳化手段彙總的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 快速上手

核心程式碼如下：

```javascript
function pLimit(concurrency) {
  const queue = []
  let active = 0

  const next = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    fn().then(resolve, reject).finally(() => {
      active--
      next()
    })
  }

  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    next()
  })
}
```

實際專案中還需要考慮邊界條件和異常處理。

## 高階用法

下面是一個實際的例子：

```javascript
class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    const handlers = this.events.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  emit(event, ...args) {
    const handlers = this.events.get(event) || []
    handlers.forEach(h => h(...args))
  }
}
```

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 業務場景

我們可以通過以下方式實現：

```javascript
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
}

function createUser(data: Partial<User>): User {
  return {
    id: Date.now(),
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'user'
  }
}

type UserKeys = keyof User  // 'id' | 'name' | 'email' | 'role'
```

注意上面程式碼中的效能細節，避免不必要的計算。

## 避坑指南

具體實現參考以下程式碼：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '張三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

經過線上驗證，這套方案執行穩定。

## 小結

- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
