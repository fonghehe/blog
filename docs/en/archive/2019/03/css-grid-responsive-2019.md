---
title: "CSS Grid Responsive Layout in Practice"
date: 2019-03-29 10:11:49
tags:
  - CSS
readingTime: 1
description: "There are many articles online about CSS Grid responsive layout, but most lack real-world experience. This article explores best practices from actual projects."
wordCount: 95
---

There are many articles online about CSS Grid responsive layout, but most lack real-world experience. This article explores best practices from actual projects.

## Core Principles

Here is a real-world example:

```css
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum calculates correctly', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce delays execution', () => {
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

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Source Analysis

This can be achieved with the following approach:

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

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Practical Application

Refer to the following implementation:

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
      return new Date(val).toLocaleDateString('en-US')
    }
  }
}
```

This setup has been validated in production and runs reliably.

## Best Practices

Here is a basic usage example:

```css

```
