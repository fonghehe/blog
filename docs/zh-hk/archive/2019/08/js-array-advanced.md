---
title: "JavaScript 數組高級方法：落地路徑與實戰建議"
date: 2019-08-20 11:02:36
tags:
  - JavaScript
readingTime: 1
description: "在團隊推廣JavaScript 數組高級方法的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
wordCount: 206
---

在團隊推廣JavaScript 數組高級方法的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 基本概念

核心代碼如下：

```javascript
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (map.has(obj)) return map.get(obj)

  const clone = Array.isArray(obj) ? [] : {}
  map.set(obj, clone)

  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key], map)
  }
  return clone
}
```

實際項目中還需要考慮邊界條件和異常處理。

## 深入理解

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 項目應用

我們可以通過以下方式實現：

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

注意上面代碼中的性能細節，避免不必要的計算。

## 小結

- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
