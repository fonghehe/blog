---
title: "React Forms: Controlled and Uncontrolled Components"
date: 2019-09-26 10:53:27
tags:
  - React
readingTime: 2
description: "Controlled vs. uncontrolled components in React forms are a common issue in everyday development. Drawing on real projects, this article shares concrete implementation approaches and lessons learned."
wordCount: 178
---

Controlled vs. uncontrolled components in React forms are a common issue in everyday development. Drawing on real projects, this article shares concrete implementation approaches and lessons learned.

## Basic Usage

Let's start with the basic usage:

```javascript
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">反转</button>
  </div>
</template>

<script>
export default {
  data() {
    return { message: 'Hello Vue 2' }
  },
  methods: {
    reverse() {
      this.message = this.message.split('').reverse().join('')
    }
  }
}
</script>
{% endraw %}
```

This approach is concise and clear, and works for most scenarios.

## Advanced Techniques

The core code looks like this:

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

In real projects you also need to account for edge cases and exception handling.

## Practical Cases

Here is a concrete example:

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

After this pattern was rolled out across the team, the results were good and maintenance costs dropped noticeably.

## Important Notes

We can implement it in the following way:

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

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Basic Usage

For a concrete implementation, see the following code:

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

This approach has been validated in production and runs stably.

## Summary

- The key to controlled vs. uncontrolled React form components is understanding the core concepts, not just surface-level usage.
- Choose the right approach for the scenario in real projects.
- In a team, agreed conventions matter more than pursuing a perfect implementation.
