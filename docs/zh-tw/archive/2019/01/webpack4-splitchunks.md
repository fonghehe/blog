---
title: "Webpack 4 SplitChunks 詳解"
date: 2019-01-23 10:11:08
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "在團隊推廣Webpack 4 SplitChunks 詳解的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
---

在團隊推廣Webpack 4 SplitChunks 詳解的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 核心原理

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

## 原始碼分析

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

## 實際應用

我們可以通過以下方式實現：

```javascript
const http = require('http')
const cluster = require('cluster')
const os = require('os')

if (cluster.isMaster) {
  const numWorkers = os.cpus().length
  console.log(`主程序 ${process.pid}，啟動 ${numWorkers} 個 worker`)

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} 退出，重啟中`)
    cluster.fork()
  })
} else {
  http.createServer((req, res) => {
    res.end(`Worker ${process.pid}`)
  }).listen(3000)
}
```

注意上面程式碼中的效能細節，避免不必要的計算。

## 小結

- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看原始碼和官方文件
