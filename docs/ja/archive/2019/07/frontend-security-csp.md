---
title: "フロントエンドセキュリティ：CSP（Content Security Policy）"
date: 2019-07-04 14:30:53
tags:
  - セキュリティ
readingTime: 3
description: "フロントエンドセキュリティはすべての開発者が重視すべきトピックです。XSS攻撃を防ぐのは難しく、ユーザー入力をフィルタリングするだけでは完璧な防御はできません。CSP（Content Security Policy）はブラウザレベルでリソースの読み込みとスクリプトの実行を制限する仕組みで、XSS防御の重要な補完策となり"
wordCount: 601
---

フロントエンドセキュリティはすべての開発者が重視すべきトピックです。XSS攻撃を防ぐのは難しく、ユーザー入力をフィルタリングするだけでは完璧な防御はできません。CSP（Content Security Policy）はブラウザレベルでリソースの読み込みとスクリプトの実行を制限する仕組みで、XSS防御の重要な補完策となります。

## CSP とは何か

CSP は HTTP レスポンスヘッダーで、どのリソースを読み込み可能か、どのリソースを禁止するかをブラウザに伝えます。たとえ攻撃者が悪意のあるスクリプトの注入に成功しても、CSP はブラウザがそれを実行するのを防げます。

最も基本的な CSP ヘッダー：

```
Content-Security-Policy: default-src 'self'
```

これは「すべてのリソース（スクリプト、スタイル、画像、フォントなど）は同一オリジンからのみ読み込み可能」を意味します。

## 設定方法

### 方法1：HTTP レスポンスヘッダー（推奨）

Nginx 設定：

```nginx
server {
    listen 80;
    server_name example.com;

    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' https://cdn.jsdelivr.net;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self' https://api.example.com;
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
    ";
}
```

Express 設定：

```javascript
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'",
  );
  next();
});
```

### 方法2：meta タグ

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'"
/>
```

注：`meta` タグ方式は `report-uri`、`frame-ancestors` などのディレクティブをサポートしていないため、本番環境では HTTP ヘッダーの使用を推奨します。

## nonce による inline スクリプト問題の解決

Webpack でビルドされるプロジェクトは inline スクリプトを生成することが多いです。CSP はデフォルトですべての inline スクリプトをブロックします。`'unsafe-inline'` を使うとセキュリティの扉を再び開けてしまいます。

より良い方法は **nonce**（一時的なランダム数）を使うことです：

```
Content-Security-Policy: script-src 'nonce-random123abc'
```

```html
<!-- これは実行される -->
<script nonce="random123abc">
  console.log("安全なインラインスクリプト");
</script>

<!-- これはブロックされる -->
<script>
  alert("悪意のあるスクリプト");
</script>
```

Node.js での実装：

```javascript
const crypto = require("crypto");

app.use((req, res, next) => {
  // リクエストごとにランダムな nonce を生成
  const nonce = crypto.randomBytes(16).toString("base64");

  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`,
  );

  res.locals.nonce = nonce;
  next();
});
```

## まとめ

- CSP はスクリプトが注入されても実行を防止できる
- 本番環境では meta タグではなく HTTP ヘッダーを使用する
- inline スクリプトには `'unsafe-inline'` の代わりに `nonce` を使用する
- `report-uri` で違反を監視・デバッグできる
- 移行時は `Content-Security-Policy-Report-Only` から始めると安全
