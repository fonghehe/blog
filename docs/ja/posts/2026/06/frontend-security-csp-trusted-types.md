---
title: "フロントエンドセキュリティ 2026：CSP Level 3 と Trusted Types の導入実践"
date: 2026-06-19 12:56:59
tags:
  - セキュリティ
readingTime: 3
description: "XSS 攻撃は依然としてフロントエンドセキュリティに対する最大の脅威だ。CSP Level 3 と Trusted Types の実践プロジェクトでの応用を体系的に解説し、より安全なフロントエンドアプリケーションの構築を支援する。"
wordCount: 560
---

XSS（クロスサイトスクリプティング）は OWASP Top 10 に長年存在し続けているセキュリティ脅威だ。2026 年、CSP Level 3 と Trusted Types は XSS 防御のコア技術となっている。その原理と実践方法を理解することは、すべてのフロントエンド開発者の必須スキルだ。

## XSS 攻撃の本質

XSS 攻撃のコアは、攻撃者がページに悪意のあるスクリプトを注入して実行できることだ：

```html
<!-- 反射型 XSS -->
<img src="x" onerror="alert('XSS')">

<!-- 格納型 XSS -->
<div class="comment">
  <script>stealCookies()</script>
</div>

<!-- DOM 型 XSS -->
<script>
  document.getElementById('output').innerHTML = location.hash.slice(1)
</script>
```

従来の XSS 防御手法（入力フィルタリング、出力エンコーディング）は効果的だが、エラーが発生しやすい。CSP と Trusted Types はより信頼性の高い防御メカニズムを提供する。

## CSP Level 3 の基礎

Content Security Policy（CSP）は、ページがロードして実行できるリソースを制限することで XSS を防御する：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-random123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
">
```

### Nonce と Hash

Nonce（ワンタイムナンバー）と Hash は CSP で最も安全なスクリプトロード方法だ：

```html
<!-- Nonce 方式 -->
<script nonce="random123">
  // 正しい Nonce を持つスクリプトのみ実行可能
  console.log('This script is allowed')
</script>

<!-- Hash 方式 -->
<script sha256="base64EncodedHash">
  // スクリプト内容のハッシュ値が一致する必要がある
</script>
```

## Trusted Types の詳細

Trusted Types は Google が提唱する DOM XSS 防御ソリューションで、すべての DOM 操作に型安全な API の使用を強制する：

```html
<meta http-equiv="Content-Security-Policy" content="
  trusted-types default;
">
```

### 基本的な使い方

```javascript
// 直接 innerHTML を使用することは禁止
element.innerHTML = userInput  // ❌ CSP 違反

// TrustedHTML を使用する必要がある
const trustedHTML = trustedTypes.createPolicy('default', {
  createHTML: (input) => {
    return DOMPurify.sanitize(input)
  }
})

element.innerHTML = trustedHTML.createHTML(userInput)  // ✅ 許可
```

### カスタムポリシーの作成

```javascript
const htmlPolicy = trustedTypes.createPolicy('htmlPolicy', {
  createHTML: (input) => {
    const allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p']
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: ['href', 'title']
    })
  }
})

const scriptURLPolicy = trustedTypes.createPolicy('scriptURLPolicy', {
  createScriptURL: (input) => {
    const allowedDomains = ['cdn.example.com', 'self']
    const url = new URL(input, location.origin)
    
    if (allowedDomains.includes(url.hostname) || input.startsWith('/')) {
      return url
    }
    
    throw new Error(`許可されていないスクリプトソース: ${input}`)
  }
})
```

## 段階的移行戦略

既存のプロジェクトでは、段階的な移行が推奨される：

```javascript
// ステップ 1：レポートのみ、ブロックしない
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  report-uri /csp-report;
">

// ステップ 2：一般的なディレクティブを追加
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  report-uri /csp-report;
">

// ステップ 3：Trusted Types を有効化
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self' 'unsafe-inline';
  trusted-types default;
  report-uri /csp-report;
">

// ステップ 4：strict モード
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  trusted-types default;
  require-trusted-types-for 'script';
">
```

## まとめ

CSP Level 3 と Trusted Types はモダンフロントエンドセキュリティの礎だ。CSP はリソースソースを制限することで XSS を防御し、Trusted Types は型安全な API により DOM インジェクション攻撃を防止する。実際のプロジェクトでは、段階的な移行が推奨される——まず違反をレポートし、次に严格的なポリシーを段階的に有効化する。Nonce、Hash、DOMPurify と組み合わせることで、真に安全なフロントエンドアプリケーションを構築できる。
