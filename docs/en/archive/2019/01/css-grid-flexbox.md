---
title: "CSS Grid and Flexbox Complementary Layout"
date: 2019-01-04 10:15:12
tags:
  - CSS
readingTime: 1
description: "Using CSS Grid and Flexbox in a complementary manner is a common challenge in day-to-day development. This article draws from real project experience to share p"
wordCount: 100
---

Using CSS Grid and Flexbox in a complementary manner is a common challenge in day-to-day development. This article draws from real project experience to share practical implementation approaches and lessons learned.

## Core Principles

Here is a basic usage example:

```css
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

This pattern is concise and suits most scenarios.

## Source Analysis

Here is the core code:

```css
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">Reverse</button>
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

In real projects, you also need to consider edge cases and error handling.

## Practical Application

Here is a concrete example:

```css
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

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Best Practices

This can be achieved with the following approach:

```css
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
