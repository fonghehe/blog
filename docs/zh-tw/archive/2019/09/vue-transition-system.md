---
title: "Vue 2 過渡與動畫系統"
date: 2019-09-06 10:53:29
tags:
  - Vue
readingTime: 1
description: "最近專案中用到了Vue 2 過渡與動畫系統，發現比預想的要複雜。分享一下實踐過程中總結的經驗。"
wordCount: 234
---

最近專案中用到了Vue 2 過渡與動畫系統，發現比預想的要複雜。分享一下實踐過程中總結的經驗。

## 快速上手

具體實現參考以下程式碼：

```css
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

經過線上驗證，這套方案執行穩定。

## 高階用法

先來看基本的用法：

```css
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

這種寫法簡潔明瞭，適合大多數場景。

## 業務場景

核心程式碼如下：

```css
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

實際專案中還需要考慮邊界條件和異常處理。

## 避坑指南

下面是一個實際的例子：

```css
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '張三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 小結

- 遇到問題多看原始碼和官方文件
- Vue 2 過渡與動畫系統的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
