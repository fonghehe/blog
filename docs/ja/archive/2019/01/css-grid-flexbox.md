---
title: "CSS GridとFlexboxの補完的レイアウト"
date: 2019-01-04 10:15:12
tags:
  - CSS
readingTime: 1
description: "CSS GridとFlexboxを補完的に使うことは、日々の開発でよく出会う課題だ。この記事では実際のプロジェクト経験から、具体的な実装方法と教訓を紹介する。"
wordCount: 229
---

CSS GridとFlexboxを補完的に使うことは、日々の開発でよく出会う課題だ。この記事では実際のプロジェクト経験から、具体的な実装方法と教訓を紹介する。

## コア原理

基本的な使い方を見てみよう：

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

このパターンは簡潔で、ほとんどのシナリオに適している。

## ソース分析

コアコードは以下の通り：

```css
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">反転</button>
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

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## 実践的な応用

具体的な例：

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

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## ベストプラクティス

以下の方法で実現できる：

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
