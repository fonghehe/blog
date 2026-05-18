---
title: "TypeScript 3.4 新特性速覽"
date: 2019-02-08 17:22:19
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 3.4 新特性速覽是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。"
---

TypeScript 3.4 新特性速覽是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。

## 核心原理

先來看基本的用法：

```javascript
import React, { Component } from 'react'

class DataList extends Component {
  state = { items: [], loading: true }

  async componentDidMount() {
    const res = await fetch('/api/items')
    const items = await res.json()
    this.setState({ items, loading: false })
  }

  render() {
    const { items, loading } = this.state
    if (loading) return <div>載入中...</div>
    return (
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    )
  }
}
```

這種寫法簡潔明瞭，適合大多數場景。

## 原始碼分析

核心程式碼如下：

```javascript
import React, { Component } from 'react'

class Form extends Component {
  state = { name: '', email: '', errors: {} }

  handleChange = (e) => {
    this.setState({ [e.target.name]: e.target.value })
  }

  handleSubmit = (e) => {
    e.preventDefault()
    const errors = this.validate()
    if (Object.keys(errors).length === 0) {
      this.props.onSubmit(this.state)
    } else {
      this.setState({ errors })
    }
  }

  validate() {
    const errors = {}
    if (!this.state.name) errors.name = '必填'
    if (!this.state.email.includes('@')) errors.email = '格式錯誤'
    return errors
  }

  render() {
    return <form onSubmit={this.handleSubmit}>...</form>
  }
}
```

實際專案中還需要考慮邊界條件和異常處理。

## 實際應用

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 最佳實踐

我們可以通過以下方式實現：

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

注意上面程式碼中的效能細節，避免不必要的計算。

## 小結

- TypeScript 3.4 新特性速覽的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
