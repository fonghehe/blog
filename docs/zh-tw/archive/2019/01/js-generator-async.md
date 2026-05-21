---
title: "JavaScript Generator 與非同步流程控制"
date: 2019-01-01 16:47:52
tags:
  - JavaScript
readingTime: 1
description: "JavaScript Generator 與非同步流程控制是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。"
wordCount: 213
---

JavaScript Generator 與非同步流程控制是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。

## 快速上手

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 高階用法

核心程式碼如下：

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

實際專案中還需要考慮邊界條件和異常處理。

## 業務場景

下面是一個實際的例子：

```javascript
const express = require('express')
const app = express()

// 中介軟體
app.use(express.json())

function errorHandler(err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? '伺服器錯誤' : err.message
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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 小結

- JavaScript Generator 與非同步流程控制的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
