---
title: "Node.js Stream 流式处理"
date: 2019-02-01 10:08:36
tags:
  - Node.js
---

Node.js Stream 流式处理是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。

## 基本概念

先来看基本的用法：

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

这种写法简洁明了，适合大多数场景。

## 深入理解

核心代码如下：

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

实际项目中还需要考虑边界条件和异常处理。

## 项目应用

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 常见问题

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 基本概念

具体实现参考以下代码：

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

经过线上验证，这套方案运行稳定。

## 小结

- Node.js Stream 流式处理的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
