---
title: "JavaScript Module System Evolution History"
date: 2019-12-24 14:43:16
tags:
  - JavaScript
readingTime: 1
description: "The evolution of JavaScript modules is something we run into constantly in day-to-day development. Drawing on real projects, this post shares concrete implementation approaches and lessons learned."
wordCount: 164
---

The evolution of JavaScript modules is something we run into constantly in day-to-day development. Drawing on real projects, this post shares concrete implementation approaches and lessons learned.

## Basic Concepts

Let's start with the basic usage:

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

This style is concise and clear, and fits most scenarios.

## Deep Dive

The core code is as follows:

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

In real projects you also need to account for edge cases and error handling.

## Project Application

Here is a concrete example:

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

After this pattern was rolled out across the team, the results were very good and maintenance cost dropped noticeably.

## Common Issues

We can implement it in the following way:

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

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Summary

- The key to JavaScript module evolution is understanding the core concepts, not stopping at surface-level usage
- In real projects, choose the right approach for the situation
- Consistent conventions across the team matter more than pursuing a perfect implementation
- Keep learning and summarizing, and stay technically aware
