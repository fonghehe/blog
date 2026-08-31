---
title: "JavaScript Proxyインターセプター"
date: 2019-10-16 17:17:13
tags:
  - JavaScript
readingTime: 2
description: "JavaScript Proxy 拦截器是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。"
wordCount: 481
---

JavaScript Proxy インターセプターは、日常の開発でよく直面する課題です。本記事では実際のプロジェクトに基づき、具体的な実装方法とこれまでの経験を共有します。

## クイックスタート

まずは基本的な使い方を見てみましょう：

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

この書き方は簡潔で分かりやすく、多くの場面に適しています。

## 高度な使い方

中核となるコードは以下のとおりです：

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
    if (loading) return <div>加载中...</div>
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

実際のプロジェクトでは、境界条件や例外処理も考慮する必要があります。

## ビジネスの場面

以下は実際の例です：

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
    if (!this.state.email.includes('@')) errors.email = '格式错误'
    return errors
  }

  render() {
    return <form onSubmit={this.handleSubmit}>...</form>
  }
}
```

このパターンをチームに広めたところ効果は良く、保守コストが明確に下がりました。

## 落とし穴回避ガイド

以下の方法で実現できます：

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

上のコードにあるパフォーマンス上の細部に注意し、不要な計算を避けましょう。

## クイックスタート

具体的な実装は以下のコードを参照してください：

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

本番環境での検証を経て、このアプローチは安定して動作しています。

## まとめ

- JavaScript Proxy インターセプターの鍵は、中核となる概念を理解することであり、表面的な使い方にとどまってはいけません
- 実際のプロジェクトでは、シチュエーションに応じて適切なアプローチを選択する
- チーム内で統一された規約を持つことは、完璧な実装を追求するよりも重要です
