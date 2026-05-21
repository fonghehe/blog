---
title: "CSS 變數主題切換方案"
date: 2019-02-21 15:40:07
tags:
  - CSS
readingTime: 1
description: "關於CSS 變數主題切換方案，網上有不少文章但大多缺乏實戰經驗。本文結合真實專案，探討最佳實踐。"
wordCount: 258
---

關於CSS 變數主題切換方案，網上有不少文章但大多缺乏實戰經驗。本文結合真實專案，探討最佳實踐。

## 基本概念

下面是一個實際的例子：

```css
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '張三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 深入理解

我們可以通過以下方式實現：

```css
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

注意上面程式碼中的效能細節，避免不必要的計算。

## 專案應用

具體實現參考以下程式碼：

```css
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

經過線上驗證，這套方案執行穩定。

## 常見問題

先來看基本的用法：

```css
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

這種寫法簡潔明瞭，適合大多數場景。

## 小結

- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看原始碼和官方文件
- CSS 變數主題切換方案的關鍵在於理解核心概念，不要停留在表面用法
