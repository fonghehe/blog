---
title: "CSS 動畫性能優化策略"
date: 2019-08-30 10:47:06
tags:
  - CSS
readingTime: 1
description: "很多同學在CSS 動畫性能優化策略上存在理解偏差，本文系統地梳理核心要點和常見誤區。"
wordCount: 211
---

很多同學在CSS 動畫性能優化策略上存在理解偏差，本文系統地梳理核心要點和常見誤區。

## 基本概念

我們可以通過以下方式實現：

```css
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

注意上面代碼中的性能細節，避免不必要的計算。

## 深入理解

具體實現參考以下代碼：

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

經過線上驗證，這套方案運行穩定。

## 項目應用

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

## 小結

- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
- CSS 動畫性能優化策略的關鍵在於理解核心概念，不要停留在表面用法
- 實際項目中根據場景選擇合適的方案
