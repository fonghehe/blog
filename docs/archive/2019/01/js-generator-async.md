---
title: "JavaScript Generator 与异步流程控制"
date: 2019-01-01 16:47:52
tags:
  - JavaScript
readingTime: 1
description: "JavaScript Generator 与异步流程控制是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。"
wordCount: 210
---

JavaScript Generator 与异步流程控制是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。

## 快速上手

先来看基本的用法：

```javascript
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-gap: 1.5rem;
}

.grid__item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.grid__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
```

这种写法简洁明了，适合大多数场景。

## 高级用法

核心代码如下：

```javascript
:root {
  --primary: #3498db;
  --bg: #fff;
  --text: #333;
}

[data-theme='dark'] {
  --primary: #5dade2;
  --bg: #1a1a2e;
  --text: #eee;
}

body {
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}
```

实际项目中还需要考虑边界条件和异常处理。

## 业务场景

下面是一个实际的例子：

```javascript
const express = require('express')
const app = express()

// 中间件
app.use(express.json())

function errorHandler(err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? '服务器错误' : err.message
  })
}

app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find()
    res.json(users)
  } catch (err) {
    next(err)
  }
})

app.use(errorHandler)
```

这种模式在团队中推广后效果很好，维护成本明显降低。

## 小结

- JavaScript Generator 与异步流程控制的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
