---
title: "JavaScript 闭包与内存管理"
date: 2019-04-24 09:46:19
tags:
  - JavaScript
readingTime: 1
description: "JavaScript 闭包与内存管理是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。"
wordCount: 208
---

JavaScript 闭包与内存管理是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。

## 快速上手

先来看基本的用法：

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

这种写法简洁明了，适合大多数场景。

## 高级用法

核心代码如下：

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

实际项目中还需要考虑边界条件和异常处理。

## 业务场景

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 小结

- JavaScript 闭包与内存管理的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
