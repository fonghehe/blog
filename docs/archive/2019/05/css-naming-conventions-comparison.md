---
title: "CSS BEM 命名规范实践"
date: 2019-05-01 10:39:56
tags:
  - CSS
readingTime: 1
description: "在团队推广CSS BEM 命名规范实践的过程中，踩了不少坑。整理出来希望对大家有所帮助。"
---

在团队推广CSS BEM 命名规范实践的过程中，踩了不少坑。整理出来希望对大家有所帮助。

## 核心原理

核心代码如下：

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

实际项目中还需要考虑边界条件和异常处理。

## 源码分析

下面是一个实际的例子：

```css
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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 实际应用

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 小结

- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
