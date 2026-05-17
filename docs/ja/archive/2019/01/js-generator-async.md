---
title: "JavaScriptジェネレーターと非同期フロー制御"
date: 2019-01-01 16:47:52
tags:
  - JavaScript
readingTime: 1
description: "JavaScriptのジェネレーターと非同期フロー制御は、日々の開発でよく出会うテーマだ。この記事では実際のプロジェクト経験から、具体的な実装方法と教訓を紹介する。"
---

JavaScriptのジェネレーターと非同期フロー制御は、日々の開発でよく出会うテーマだ。この記事では実際のプロジェクト経験から、具体的な実装方法と教訓を紹介する。

## はじめに

基本的な使い方を見てみよう：

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

このパターンは簡潔で、ほとんどのシナリオに適している。

## 応用的な使い方

コアコードは以下の通り：

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

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## ビジネスシナリオ

実際の例：

```javascript
const express = require("express");
const app = express();

// ミドルウェア
app.use(express.json());

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production" ? "サーバーエラー" : err.message,
  });
}

app.get("/api/users", async (req, res, next) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);
```

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## まとめ

- JavaScriptジェネレーターと非同期フロー制御のカギはコアコンセプトを理解すること——表面的な使い方にとどまらないこと
- 実際のプロジェクトではシナリオに応じた適切な方法を選ぶ
- チームで統一した規約を作ることは、完璧な実装を追求することより重要だ
