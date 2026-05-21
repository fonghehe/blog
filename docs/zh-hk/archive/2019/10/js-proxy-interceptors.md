---
title: "JavaScript Proxy 攔截器"
date: 2019-10-16 17:17:13
tags:
  - JavaScript
readingTime: 2
description: "JavaScript Proxy 攔截器是日常開發中經常遇到的問題。本文從實際項目出發，分享具體的實現方法和經驗總結。"
wordCount: 270
---

JavaScript Proxy 攔截器是日常開發中經常遇到的問題。本文從實際項目出發，分享具體的實現方法和經驗總結。

## 快速上手

先來看基本的用法：

```javascript
export default {
  directives: {
    focus: {
      inserted(el) {
        el.focus()
      }
    },
    loading: {
      bind(el, binding) {
        if (binding.value) {
          el.classList.add('loading')
        }
      },
      update(el, binding) {
        el.classList.toggle('loading', binding.value)
      }
    }
  }
}
```

這種寫法簡潔明瞭，適合大多數場景。

## 高級用法

核心代碼如下：

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
    if (loading) return <div>加載中...</div>
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

實際項目中還需要考慮邊界條件和異常處理。

## 業務場景

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 避坑指南

我們可以通過以下方式實現：

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

注意上面代碼中的性能細節，避免不必要的計算。

## 快速上手

具體實現參考以下代碼：

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

經過線上驗證，這套方案運行穩定。

## 小結

- JavaScript Proxy 攔截器的關鍵在於理解核心概念，不要停留在表面用法
- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
