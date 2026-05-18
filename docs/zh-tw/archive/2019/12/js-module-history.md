---
title: "JavaScript 模組化演進史"
date: 2019-12-24 14:43:16
tags:
  - JavaScript
readingTime: 1
description: "JavaScript 模組化演進史是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。"
---

JavaScript 模組化演進史是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。

## 基本概念

先來看基本的用法：

```javascript
export default {
  props: ['items'],
  computed: {
    sorted() {
      return [...this.items].sort((a, b) => b.score - a.score)
    },
    count() {
      return this.items.length
    }
  },
  filters: {
    formatDate(val) {
      return new Date(val).toLocaleDateString('zh-CN')
    }
  }
}
```

這種寫法簡潔明瞭，適合大多數場景。

## 深入理解

核心程式碼如下：

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

實際專案中還需要考慮邊界條件和異常處理。

## 專案應用

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 常見問題

我們可以通過以下方式實現：

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

注意上面程式碼中的效能細節，避免不必要的計算。

## 小結

- JavaScript 模組化演進史的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
