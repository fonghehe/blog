---
title: "React 错误边界 ErrorBoundary"
date: 2019-11-22 10:26:45
tags:
  - React
readingTime: 2
description: "很多同学在React 错误边界 ErrorBoundary上存在理解偏差，本文系统地梳理核心要点和常见误区。"
wordCount: 257
---

很多同学在React 错误边界 ErrorBoundary上存在理解偏差，本文系统地梳理核心要点和常见误区。

## 快速上手

我们可以通过以下方式实现：

```javascript
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors'
        }
      }
    }
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    new MiniCssExtractPlugin({ filename: '[name].css' })
  ]
}
```

注意上面代码中的性能细节，避免不必要的计算。

## 高级用法

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

## 业务场景

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

## 避坑指南

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

## 快速上手

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

## 小结

- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
- React 错误边界 ErrorBoundary的关键在于理解核心概念，不要停留在表面用法
