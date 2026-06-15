---
title: "フロントエンドセキュリティ 2026：CSP v3 とサブリソースインテグリティ"
date: 2026-06-15 14:39:35
tags:
  - セキュリティ
readingTime: 2
description: "Content Security Policy v3 と Subresource Integrity は 2026 年のフロントエンドセキュリティの2つの柱だ。CSP の設定戦略、SRI の使用方法、よくあるセキュリティ陷阱を議論する。"
wordCount: 367
---

フロントエンドセキュリティはもはや「オプションの追加项」ではなく、アプリケーションアーキテクチャのコア部分だ。2026 年の Web セキュリティ環境はより複雑で、CSP v3 と SRI は標準化された保護メカニズムを提供する。

## Content Security Policy の基礎

CSP は HTTP ヘッダーまたは meta タグでリソースロードを制御する：

```html
<!-- HTTP ヘッダー -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'

<!-- meta タグ -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'nonce-abc123'">
```

## CSP v3 の新機能

```html
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

主な改善：
- **`strict-dynamic`**：既存スクリプトがロードするスクリプトを信頼
- **`frame-ancestors`**：`X-Frame-Options` を置き換え
- **`base-uri`**：`<base>` タグハイジャックを防止
- **`form-action`**：フォーム送信先を制限

## Nonce の生成と使用

```typescript
// サーバーサイド nonce 生成
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// ミドルウェアで CSP ヘッダーを追加
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
  `);
  
  next();
});
```

## Subresource Integrity

SRI は外部リソースの改ざんを防止する：

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

## よくあるセキュリティ陷阱

**陷阱 1：`unsafe-inline` のリスク**

```html
<!-- 危険：任意のインラインスクリプトを許可 -->
Content-Security-Policy: script-src 'self' 'unsafe-inline'

<!-- 安全：nonce を使用 -->
Content-Security-Policy: script-src 'self' 'nonce-abc123'
```

## 段階的デプロイ

```html
<!-- フェーズ 1：レポートのみ -->
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report

<!-- フェーズ 2：緩いポリシー -->
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval'

<!-- フェーズ 3：厳格なポリシー -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxx'
```

## まとめ

CSP v3 と SRI は 2026 年のフロントエンドセキュリティの基盤だ。CSP はリソースロードソースを制御し、SRI はリソースの整合性を確保する。デプロイは段階的に行い、まず Report-Only でデータを収集し、次にポリシーを徐々に厳格化すべきだ。セキュリティは一度きりの作業ではなく、継続的なプロセスだ。
