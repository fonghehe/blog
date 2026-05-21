---
title: "Vue 2 自定义指令实战"
date: 2019-02-27 17:05:59
tags:
  - Vue
readingTime: 1
description: "在团队推广Vue 2 自定义指令实战的过程中，踩了不少坑。整理出来希望对大家有所帮助。"
wordCount: 195
---

在团队推广Vue 2 自定义指令实战的过程中，踩了不少坑。整理出来希望对大家有所帮助。

## 基础用法

核心代码如下：

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

实际项目中还需要考虑边界条件和异常处理。

## 进阶技巧

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 实战案例

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 小结

- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
