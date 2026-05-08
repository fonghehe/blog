---
title: "CSS Grid 响应式布局实战"
date: 2019-03-29 10:11:49
tags:
  - CSS
---

关于CSS Grid 响应式布局实战，网上有不少文章但大多缺乏实战经验。本文结合真实项目，探讨最佳实践。

## 核心原理

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 源码分析

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 实际应用

具体实现参考以下代码：

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

经过线上验证，这套方案运行稳定。

## 最佳实践

先来看基本的用法：

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

这种写法简洁明了，适合大多数场景。

## 小结

- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
- CSS Grid 响应式布局实战的关键在于理解核心概念，不要停留在表面用法
