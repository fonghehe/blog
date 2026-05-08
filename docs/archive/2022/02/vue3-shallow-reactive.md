---
title: "Vue 3.2 浅层响应式"
date: 2022-02-03 10:05:35
tags:
  - Vue
  - React
---

在日常工作中经常用到Vue 3.2 浅层响应式，整理一篇系统性的总结，希望能帮助大家更好地理解和应用。

## 基础概念

来看具体的实现方式：

```javascript
// 使用示例
import { createApp } from './app'

const config = {
  apiBase: process.env.API_BASE || '/api',
  timeout: 10000,
  retries: 3
}

const app = createApp(config)
app.mount('#root')

```

这种实现方式简洁高效，适合大多数场景。

## 核心实现

下面是一个实际的示例：

```javascript
// 工具函数封装
function createHandler(options = {}) {
  const { timeout = 5000, retries = 3 } = options

  return async function execute(url, data) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)
        const res = await fetch(url, {
          method: 'POST',
          body: JSON.stringify(data),
          signal: controller.signal
        })
        clearTimeout(timer)
        return await res.json()
      } catch (err) {
        if (attempt === retries - 1) throw err
      }
    }
  }
}

```

在实际项目中，还需要根据具体需求做适当调整。

## 实战应用

核心代码如下：

```javascript
// 核心实现
const processData = (input) => {
  return input
    .filter(item => item.active)
    .map(item => ({
      ...item,
      displayName: item.name.trim(),
      timestamp: Date.now()
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

```

注意处理好边界条件和异常情况。

## 最佳实践

我们可以这样实现：

```javascript
// 使用示例
import { createApp } from './app'

const config = {
  apiBase: process.env.API_BASE || '/api',
  timeout: 10000,
  retries: 3
}

const app = createApp(config)
app.mount('#root')

```

通过这种模式，代码的可维护性得到了提升。

## 小结

- Vue 3.2 浅层响应式的核心在于理解底层原理，而非仅仅记住 API
- 在实际项目中，选择合适的方案比追求最新技术更重要
- 团队协作中保持代码风格一致，降低维护成本