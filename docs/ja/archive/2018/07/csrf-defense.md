---
title: "CSRF攻撃と防御の実践"
date: 2018-07-09 17:42:13
tags:
  - セキュリティ
readingTime: 3
description: "以前XSSの防御について書きましたが、今回はCSRFについて説明します。両者はよく一緒に語られますが、原理はまったく異なります。"
wordCount: 653
---

以前XSSの防御について書きましたが、今回はCSRFについて説明します。両者はよく一緒に語られますが、原理はまったく異なります。

## CSRFとは

CSRF（クロスサイトリクエストフォージェリ）：攻撃者がログイン済みのユーザーを騙して悪意あるページを訪れさせ、そのページがユーザーの代わりにリクエストを送信します。

```
通常のフロー：ユーザー → 銀行サイトにログイン（cookieを取得）→ 送金

CSRF攻撃：
ユーザー → 銀行にログイン（cookieあり）
        → 攻撃者のページを閲覧（<img src="https://bank.com/transfer?to=hacker&amount=10000">を含む）
        → ブラウザが自動的に銀行のcookieを付けてリクエストを送信
        → 銀行が送金を実行！
```

重要な点：ブラウザはリクエスト送信時に対象ドメインのcookieを自動的に送信するため、攻撃者がcookieの値を知る必要はありません。

## 防御方法

### 1. CSRFトークン（最も一般的）

サーバーがランダムなトークンを生成してフォームやリクエストヘッダーに埋め込みます。攻撃者は偽造できません：

```javascript
// サーバー：トークンを生成してセッションに保存
const csrfToken = crypto.randomBytes(32).toString("hex");
req.session.csrfToken = csrfToken;

// フロントエンドに返す（レスポンスヘッダーまたはmetaタグ）
res.setHeader("X-CSRF-Token", csrfToken);
```

```javascript
// フロントエンド：すべてのリクエストにトークンを含める
// axiosのグローバル設定
axios.interceptors.request.use((config) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) {
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});
```

```javascript
// サーバー：トークンを検証
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next(); // 読み取り専用リクエストは検証不要
  }

  const token = req.headers["x-csrf-token"];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  next();
});
```

### 2. SameSite Cookie

モダンブラウザはクロスサイトリクエスト時のcookie送信を制御する`SameSite`属性をサポートしています：

```
Set-Cookie: session=xxx; SameSite=Strict; HttpOnly; Secure
```

- `Strict`：クロスサイトリクエストではcookieを一切送信しない
- `Lax`：クロスサイトナビゲーション（リンク遷移）は許可、form/fetchリクエストは不許可（Chrome 80+のデフォルト）
- `None`：クロスサイトでも送信（Secureの同時設定が必須）

```javascript
// Expressのcookie設定
res.cookie("sessionId", token, {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // 本番環境はstrictを推奨
});
```

### 3. Referer/Originの検証

リクエストの送信元ドメインを確認します：

```javascript
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.startsWith("https://yourdomain.com")) {
    return res.status(403).json({ error: "Invalid origin" });
  }
  next();
});
```

欠点：Refererヘッダーはユーザーやプロキシによって除去される場合があるため、単独での信頼性は低いです。

## CSRF vs XSS

|                    | CSRF                           | XSS                                            |
| ------------------ | ------------------------------ | ---------------------------------------------- |
| 悪用するもの       | ユーザーの身元（cookie）       | ブラウザで攻撃者のコードを実行                 |
| 攻撃者ができること | ユーザーとしてリクエストを送信 | cookieの読み取り、ページ改ざん、リクエスト送信 |
| 防御の核心         | Token + SameSite Cookie        | CSP + 入力のエスケープ                         |

## まとめ

- CSRFはブラウザが自動的にcookieを送信する仕組みを悪用し、ユーザーが知らないうちにリクエストを送信させる
- CSRFトークンが最も汎用的な防御手段
- `SameSite: Lax/Strict`はモダンブラウザで有効な防御
- GETリクエストには副作用を持たせない（そうしないとimg srcで攻撃される）
