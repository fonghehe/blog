---
title: "Webpack 4 Tree Shaking 深入：落地路徑與實戰建議"
date: 2019-03-21 09:49:12
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "在團隊推廣Webpack 4 Tree Shaking 深入的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
wordCount: 192
---

在團隊推廣Webpack 4 Tree Shaking 深入的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 基礎用法

核心代碼如下：

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

實際項目中還需要考慮邊界條件和異常處理。

## 進階技巧

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

## 實戰案例

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

注意上面代碼中的性能細節，避免不必要的計算。

## 小結

- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
