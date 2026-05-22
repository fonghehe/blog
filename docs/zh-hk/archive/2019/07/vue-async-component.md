---
title: "Vue 2 異步組件加載：落地路徑與實戰建議"
date: 2019-07-02 17:09:18
tags:
  - Vue
readingTime: 1
description: "很多同學在Vue 2 異步組件加載上存在理解偏差，本文系統地梳理核心要點和常見誤區。"
wordCount: 224
---

很多同學在Vue 2 異步組件加載上存在理解偏差，本文系統地梳理核心要點和常見誤區。

## 快速上手

我們可以通過以下方式實現：

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

注意上面代碼中的性能細節，避免不必要的計算。

## 高級用法

具體實現參考以下代碼：

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

經過線上驗證，這套方案運行穩定。

## 業務場景

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 避坑指南

核心代碼如下：

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

實際項目中還需要考慮邊界條件和異常處理。

## 小結

- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
- Vue 2 異步組件加載的關鍵在於理解核心概念，不要停留在表面用法
