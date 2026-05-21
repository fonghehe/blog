---
title: "React Refs 转发与使用场景"
date: 2019-05-16 17:14:10
tags:
  - React
readingTime: 2
description: "最近项目中用到了React Refs 转发与使用场景，发现比预想的要复杂。分享一下实践过程中总结的经验。"
wordCount: 286
---

最近项目中用到了React Refs 转发与使用场景，发现比预想的要复杂。分享一下实践过程中总结的经验。

## 核心原理

具体实现参考以下代码：

```javascript
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum 计算正确', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce 延迟执行', () => {
    jest.useFakeTimers()
    const fn = jest.fn()
    const debounced = debounce(fn, 300)

    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

经过线上验证，这套方案运行稳定。

## 源码分析

先来看基本的用法：

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

这种写法简洁明了，适合大多数场景。

## 实际应用

核心代码如下：

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

实际项目中还需要考虑边界条件和异常处理。

## 最佳实践

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 核心原理

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 小结

- 遇到问题多看源码和官方文档
- React Refs 转发与使用场景的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
