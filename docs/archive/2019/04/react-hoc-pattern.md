---
title: "React 高阶组件 HOC 模式"
date: 2019-04-09 10:45:08
tags:
  - React
readingTime: 1
description: "关于React 高阶组件 HOC 模式，网上有不少文章但大多缺乏实战经验。本文结合真实项目，探讨最佳实践。"
wordCount: 195
---

关于React 高阶组件 HOC 模式，网上有不少文章但大多缺乏实战经验。本文结合真实项目，探讨最佳实践。

## 基础用法

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 进阶技巧

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 实战案例

具体实现参考以下代码：

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

经过线上验证，这套方案运行稳定。

## 小结

- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
