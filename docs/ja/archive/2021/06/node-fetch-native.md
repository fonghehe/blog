---
title: "Node.js ネイティブ fetch API プレビュー"
date: 2021-06-03 14:50:28
tags:
  - JavaScript
  - Node.js

readingTime: 2
description: "Node.js 内置 fetch API 预览このテーマはコミュニティで何度も議論されていますが、バージョンアップに伴い多くの結論は更新が必要です。本記事では最新バージョンをベースに改めて整理します。"
wordCount: 448
---

Node.js に組み込みの fetch API がプレビューとして登場した。この話題はコミュニティで何度も議論されてきたが、バージョンアップに伴って多くの結論が更新を要する。本記事では最新バージョンをベースに改めて整理する。

## 入門ガイド

基本的な実装方法を見てみよう：

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

このコードは基本的な使い方を示している。実際のプロジェクトではエラー処理と境界条件も考慮する必要がある。

## ソースコード分析

この基盤の上でさらに最適化できる：

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

このパターンは大規模プロジェクトで非常に実用的で、保守コストを大幅に削減できる。

## 実際のケースへの応用

実際のプロジェクトでは、使い方はもう少し複雑になる：

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

このアプローチにより、コードのテスト可能性とスケーラビリティが向上する。

## 最適化テクニック

完全なサンプルを以下に示す：

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

境界条件の処理に注意する必要がある。これは本番環境で非常に重要だ。

## まとめ

- チームでの協業では、規約とドキュメントが技術そのものより重要だ
- コミュニティの動向を注視し、技術的なアプローチは継続的な反復が必要だ
- 新しい技術を使うためだけに新しい技術を使うべきではない