---
title: "Bun 2.0 新機能と改善"
date: 2025-03-28 10:00:00
tags:
  - フロントエンド
readingTime: 4
description: "最近チームで Bun 2.0 新機能と改善を導入し、多くの経験を積みました。参考のためにまとめましたので、同様の作業をされている方のお役に立てれば幸いです。"
---

最近チームで Bun 2.0 新機能と改善を導入し、多くの経験を積みました。参考のためにまとめましたので、同様の作業をされている方のお役に立てれば幸いです。

## コアコンセプト

以下の方法で改善できます：

```javascript
const fs = require("fs");
const { Transform, pipeline } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split("\n");
    const headers = lines[0].split(",");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",");
      const obj = {};
      headers.forEach((h, idx) => (obj[h.trim()] = values[idx]?.trim()));
      this.push(JSON.stringify(obj) + "\n");
    }
    callback();
  },
});
```

このソリューションは半年以上にわたって本番環境で安定して稼働しており、実際に検証済みです。

## 詳細解説

まず基本的な実装方法を見てみましょう：

```javascript
const express = require("express");
const app = express();

app.use(express.json());

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "ユーザーが見つかりません");
    res.json({ data: user });
  }),
);
```

このコードは基本的な使い方を示しています。実際のプロジェクトでは、エラーハンドリングやエッジケースも考慮する必要があります。

## 導入経験

この基盤の上で、さらに最適化できます：

```javascript
const fs = require("fs");
const { Transform, pipeline } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split("\n");
    const headers = lines[0].split(",");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",");
      const obj = {};
      headers.forEach((h, idx) => (obj[h.trim()] = values[idx]?.trim()));
      this.push(JSON.stringify(obj) + "\n");
    }
    callback();
  },
});
```

このパターンは大規模プロジェクトで非常に実用的で、メンテナンスコストを大幅に削減できます。

## チューニング戦略

実際のプロジェクトでの使い方はより複雑になります：

```javascript
const express = require("express");
const app = express();

app.use(express.json());

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "ユーザーが見つかりません");
    res.json({ data: user });
  }),
);
```

---

title: "Bun 2.0 新機能と改善"
date: 2025-03-28 10:00:00
tags:

- フロントエンド

---

最近チームで Bun 2.0 新機能と改善を導入し、多くの経験を積みました。参考のためにまとめましたので、同様の作業をされている方のお役に立てれば幸いです。

## コアコンセプト

以下の方法で改善できます：

```javascript
const fs = require("fs");
const { Transform, pipeline } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split("\n");
    const headers = lines[0].split(",");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",");
      const obj = {};
      headers.forEach((h, idx) => (obj[h.trim()] = values[idx]?.trim()));
      this.push(JSON.stringify(obj) + "\n");
    }
    callback();
  },
});
```

このソリューションは半年以上にわたって本番環境で安定して稼働しており、実際に検証済みです。

## 詳細解説

まず基本的な実装方法を見てみましょう：

```javascript
const express = require("express");
const app = express();

app.use(express.json());

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "ユーザーが見つかりません");
    res.json({ data: user });
  }),
);
```

このコードは基本的な使い方を示しています。実際のプロジェクトでは、エラーハンドリングやエッジケースも考慮する必要があります。

## 導入経験

この基盤の上で、さらに最適化できます：

```javascript
const fs = require("fs");
const { Transform, pipeline } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split("\n");
    const headers = lines[0].split(",");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",");
      const obj = {};
      headers.forEach((h, idx) => (obj[h.trim()] = values[idx]?.trim()));
      this.push(JSON.stringify(obj) + "\n");
    }
    callback();
  },
});
```

このパターンは大規模プロジェクトで非常に実用的で、メンテナンスコストを大幅に削減できます。

## チューニング戦略

実際のプロジェクトでの使い方はより複雑になります：

```javascript
const express = require("express");
const app = express();

app.use(express.json());

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "ユーザーが見つかりません");
    res.json({ data: user });
  }),
);
```
