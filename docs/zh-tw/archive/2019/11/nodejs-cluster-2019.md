---
title: "Node.js Cluster 多程序"
date: 2019-11-29 14:45:51
tags:
  - JavaScript
readingTime: 1
description: "最近專案中用到了Node.js Cluster 多程序，發現比預想的要複雜。分享一下實踐過程中總結的經驗。"
wordCount: 226
---

最近專案中用到了Node.js Cluster 多程序，發現比預想的要複雜。分享一下實踐過程中總結的經驗。

## 快速上手

具體實現參考以下程式碼：

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

經過線上驗證，這套方案執行穩定。

## 高階用法

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

## 業務場景

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

## 避坑指南

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

## 小結

- 遇到問題多看原始碼和官方文件
- Node.js Cluster 多程序的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
