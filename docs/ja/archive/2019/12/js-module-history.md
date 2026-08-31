---
title: "JavaScriptモジュールシステムの進化史"
date: 2019-12-24 14:43:16
tags:
  - JavaScript
readingTime: 2
description: "JavaScript 模块化演进史是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。"
wordCount: 370
---

JavaScript 模块化演进史是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。

## 基本概念

まずは基本的な使い方から：

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

この書き方は簡潔明快で、ほとんどのシーンに向いている。

## 深掘り

コアとなるコードは以下のとおり：

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

実際のプロジェクトでは、境界条件や例外処理も考慮する必要がある。

## プロジェクト応用

以下は実際の例である：

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
    if (loading) return <div>読み込み中...</div>
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

このパターンをチームに導入したところ効果が良く、保守コストが明らかに低下した。

## よくある質問

以下の方法で実現できる：

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

上記コードのパフォーマンス上の細部に注意し、不要な計算を避けること。

## まとめ

- JavaScript 模块化演进史的关键在于理解核心概念，不要停留在表面用法
- 実際のプロジェクトでは、場面に応じて適切なアプローチを選ぶこと
- チーム内で統一した取り決めを作ることは、完璧な実装を追及するよりも重要だ
- 継続的に学び、振り返りを行い、技術に対する感度を保つこと
