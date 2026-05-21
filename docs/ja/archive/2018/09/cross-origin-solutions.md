---
title: "クロスオリジンリクエストの各種解決策"
date: 2018-09-26 16:39:34
tags:
  - フロントエンド
readingTime: 4
description: "クロスオリジンはフロントエンド開発で避けられない問題です。よく使われる解決策とそれぞれの適用場面を整理します。"
wordCount: 808
---

クロスオリジンはフロントエンド開発で避けられない問題です。よく使われる解決策とそれぞれの適用場面を整理します。

## クロスオリジンとは

ブラウザの同一オリジンポリシー：プロトコル、ドメイン名、ポートのいずれかが異なればクロスオリジンになります。

```
https://api.example.com  と  https://www.example.com  → クロスオリジン（サブドメインが異なる）
http://example.com       と  https://example.com      → クロスオリジン（プロトコルが異なる）
https://example.com      と  https://example.com:8080 → クロスオリジン（ポートが異なる）
https://example.com      と  https://example.com      → 同一オリジン ✅
```

## 方法1：CORS（最推奨）

サーバーサイドでレスポンスヘッダーを設定し、クロスオリジンリクエストを許可します：

```javascript
// Node.js / Express
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.example.com");
  // または全オリジンを許可（開発環境）
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true"); // Cookie の送信を許可

  if (req.method === "OPTIONS") {
    // プリフライトリクエスト
    res.status(200).end();
    return;
  }

  next();
});
```

**フロントエンドの注意点：**

```javascript
// クロスオリジンリクエストで Cookie を送る：両側の設定が必要
fetch("https://api.example.com/data", {
  credentials: "include", // Cookie を送信
});

// axios
axios.defaults.withCredentials = true;
```

**注意**：`Access-Control-Allow-Origin` が `*` の場合、`Access-Control-Allow-Credentials: true` と同時に設定できません。

## 方法2：開発環境プロキシ

開発環境で最もシンプルな方法。webpack dev server でプロキシします：

```javascript
// vue.config.js
module.exports = {
  devServer: {
    proxy: {
      "/api": {
        target: "https://api.example.com",
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },
};
```

フロントエンドが `/api/users` にリクエスト → プロキシが `https://api.example.com/users` に転送。

ブラウザからは同一オリジンのリクエスト（どちらも localhost）に見え、クロスオリジン問題がありません。

## 方法3：Nginx リバースプロキシ

本番環境でよく使われる方法。Nginx 層でプロキシします：

```nginx
server {
  listen 80;
  server_name www.example.com;

  location / {
    root /var/www/html;
    try_files $uri $uri/ /index.html;
  }

  # API リクエストをプロキシ
  location /api {
    proxy_pass https://api.internal.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

フロントエンドは同一オリジンの `/api` にリクエストするだけで、Nginx が転送を担当します。

## 方法4：JSONP（非推奨）

GET リクエストのみ対応。script タグが同一オリジンポリシーの制限を受けないことを利用：

```javascript
// フロントエンド
function jsonp(url, callback) {
  const callbackName = `jsonp_${Date.now()}`;
  window[callbackName] = (data) => {
    callback(data);
    delete window[callbackName];
    script.remove();
  };

  const script = document.createElement("script");
  script.src = `${url}?callback=${callbackName}`;
  document.head.appendChild(script);
}

jsonp("https://api.example.com/data", (data) => {
  console.log(data);
});

// サーバーは callbackName({"key": "value"}) を返す必要がある
```

現在はほとんど使われていません。CORS の方が優れています。

## 方法5：postMessage（iframe 通信）

異なるオリジンの iframe やウィンドウ間の通信：

```javascript
// 親ページ：メッセージを送信
const iframe = document.getElementById("myFrame");
iframe.contentWindow.postMessage(
  { type: "REQUEST_DATA", payload: { id: 1 } },
  "https://other.example.com", // ターゲットのオリジン、必ず指定する
);

// iframe ページ：メッセージを受信
window.addEventListener("message", (e) => {
  // セキュリティチェック：送信元を検証
  if (e.origin !== "https://www.example.com") return;

  const { type, payload } = e.data;

  if (type === "REQUEST_DATA") {
    // リクエストを処理して親ページに返信
    e.source.postMessage({ type: "RESPONSE_DATA", data: result }, e.origin);
  }
});
```

## 方法6：document.domain（同一主ドメイン・異なるサブドメイン）

同一主ドメイン（例：`a.example.com` と `b.example.com`）にのみ適用：

```javascript
// a.example.com と b.example.com の両方で設定：
document.domain = "example.com";
// その後は互いの document にアクセスできる
```

セキュリティ上の問題があり、新しいブラウザでは段階的に廃止されています。

## 各方法の比較

| 方法           | 適用場面              | メリット                         | デメリット                       |
| -------------- | --------------------- | -------------------------------- | -------------------------------- |
| CORS           | すべての場面          | 標準方法、全リクエストタイプ対応 | サーバーサイドの設定が必要       |
| 開発プロキシ   | 開発環境のみ          | 設定が簡単                       | 本番環境では無効                 |
| Nginx プロキシ | 本番環境              | フロントエンドは意識不要         | インフラの協力が必要             |
| JSONP          | レガシーシステム      | 古いブラウザに対応               | GET のみ、セキュリティリスクあり |
| postMessage    | iframe/ウィンドウ通信 | クロスオリジン通信の標準方法     | 特定のシナリオにのみ適用         |

## まとめ

- プロジェクトは CORS + Nginx プロキシの組み合わせを推奨
- 開発環境は webpack devServer proxy でゼロ設定
- JSONP はほぼ不要。レガシープロジェクトの保守以外では忘れてよい
- `postMessage` は iframe 通信の正しい方法。`e.origin` の検証を忘れずに
