---
title: "React Context 替代 Redux"
date: 2019-03-06 17:27:58
tags:
  - React
readingTime: 2
description: "在團隊推廣React Context 替代 Redux的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
---

在團隊推廣React Context 替代 Redux的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 核心原理

核心代碼如下：

```javascript
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum 計算正確', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce 延遲執行', () => {
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

實際項目中還需要考慮邊界條件和異常處理。

## 源碼分析

下面是一個實際的例子：

```javascript
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">反轉</button>
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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 實際應用

我們可以通過以下方式實現：

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

注意上面代碼中的性能細節，避免不必要的計算。

## 最佳實踐

具體實現參考以下代碼：

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

經過線上驗證，這套方案運行穩定。

## 核心原理

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
    if (loading) return <div>加載中...</div>
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

## 小結

- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
