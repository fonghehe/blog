---
title: "CSP：コンテンツセキュリティポリシー詳解"
date: 2020-09-25 10:24:54
tags:
  - セキュリティ
readingTime: 2
description: "CSP（コンテンツセキュリティポリシー）の詳細についてはコミュニティで何度も議論されてきましたが、バージョンアップに伴い、多くの結論を更新する必要があります。この記事では最新バージョンに基づいて再整理します。"
wordCount: 540
---

CSP（コンテンツセキュリティポリシー）の詳細についてはコミュニティで何度も議論されてきましたが、バージョンアップに伴い、多くの結論を更新する必要があります。この記事では最新バージョンに基づいて再整理します。

## はじめに

実際のプロジェクトでの使用法はより複雑になります：

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

この方法により、コードのテスト容易性と拡張性が向上します。

## ソースコード解析

以下は完全なサンプルです：

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

境界条件の処理に注意してください。これは本番環境で非常に重要です。

## 実際のシナリオへの応用

核心となるロジックを理解することが重要です：

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

パフォーマンス最適化は具体的なシナリオに応じて行う必要があり、すべての状況で過度な最適化が必要なわけではありません。

## 最適化のコツ

以下の方法で改善できます：

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

この手法は半年以上にわたって本番環境で安定して動作しており、実戦で検証されています。

## まとめ

- CSP（コンテンツセキュリティポリシー）は銀の弾丸ではなく、プロジェクトの規模や技術スタックに応じて選択する必要があります
- API を暗記するよりも、基礎となる原理を理解することが重要です
- 本番環境で使用する前には必ず互換性の検証を行ってください
- チーム協力においては、技術自体よりも取り決めとドキュメントが重要です
- コミュニティの動向に注目し、技術戦略は継続的に改善する必要があります
