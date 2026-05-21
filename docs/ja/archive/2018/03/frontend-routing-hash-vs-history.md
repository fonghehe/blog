---
title: "フロントエンドルーティングの原理：hash モード vs history モード"
date: 2018-03-20 14:39:59
tags:
  - フロントエンド
readingTime: 4
description: "Vue Router の 2 つのモードはほぼすべてのプロジェクトで選択が必要ですが、なぜ 2 種類あるのか、違いは何かを理解していない人が多いです。この記事では原理から説明します。"
wordCount: 866
---

Vue Router の 2 つのモードはほぼすべてのプロジェクトで選択が必要ですが、なぜ 2 種類あるのか、違いは何かを理解していない人が多いです。この記事では原理から説明します。

## なぜフロントエンドルーティングが必要か

従来のマルチページアプリ：毎回の遷移でサーバーに新しいページをリクエストし、ページ全体がリフレッシュされます。

シングルページアプリケーション（SPA）：HTML を一度だけ読み込み、その後のページ切り替えはクライアント側で行われ、サーバーに新しいページをリクエストしません。

問題：ブラウザの URL を変えながらページリフレッシュを引き起こさないにはどうすればいいか？それがフロントエンドルーティングの答えです。

## Hash モード

URL の `#` アンカー（hash）部分を利用します。hash 変化に対するブラウザの動作：

1. URL の `#` 以降の部分が変化しても、**サーバーにリクエストは送らない**
2. `hashchange` イベントが発火する
3. ブラウザ履歴に追加される（前後移動可能）

```javascript
// hash の変化を監視
window.addEventListener("hashchange", (event) => {
  const newHash = location.hash; // '#/about'
  const path = newHash.slice(1); // '/about'
  renderRoute(path);
});

// 遷移：hash を変更
location.hash = "#/about"; // hashchange が発火するがページはリフレッシュしない
```

**Hash モードの URL の見た目：**

```
http://example.com/#/
http://example.com/#/about
http://example.com/#/users/123
```

## History モード

HTML5 の History API を利用します：

```javascript
// pushState：履歴エントリを追加、URL を更新、ページリフレッシュなし
history.pushState({ page: 1 }, "title", "/about");

// replaceState：現在の履歴エントリを置き換え
history.replaceState({ page: 1 }, "title", "/about");

// 前後移動を監視
window.addEventListener("popstate", (event) => {
  const path = location.pathname; // '/about'
  renderRoute(path);
});
```

**History モードの URL の見た目：**

```
http://example.com/
http://example.com/about
http://example.com/users/123
```

`#` がなくクリーンな URL です。

## 2 つの核心的な違い

| 特性         | Hash モード                      | History モード |
| ------------ | -------------------------------- | -------------- |
| URL の外観   | `#` あり                         | クリーン       |
| サーバー設定 | 不要                             | 必要           |
| 互換性       | より良い（IE8+）                 | IE10+          |
| SEO          | 普通（`#` 以降の内容は議論あり） | より良い       |

## History モードにはサーバー設定が必要

これが History モードの最大の落とし穴です。

ユーザーが直接 `http://example.com/users/123` にアクセスすると、サーバーは `/users/123` のファイルを探そうとしますが、見つからないと 404 になります。

解決策：**すべてのパスで `index.html` を返すようサーバーを設定し**、フロントエンドルーターに処理させます。

**Nginx 設定：**

```nginx
server {
  listen 80;
  root /var/www/myapp;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;  # ファイルが見つからなければ index.html を返す
  }
}
```

**Apache .htaccess：**

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**開発環境（webpack-dev-server）：**

```javascript
devServer: {
  historyApiFallback: true; // 自動的に処理する
}
```

## Vue Router の設定

```javascript
const router = new VueRouter({
  mode: 'history',  // 'hash' がデフォルト
  routes: [...]
})
```

## シンプルな Hash ルーターを実装する

原理を理解する最良の方法は自分で実装することです：

```javascript
class HashRouter {
  constructor(routes) {
    this.routes = routes;
    this.currentPath = location.hash.slice(1) || "/";

    window.addEventListener("hashchange", () => {
      this.currentPath = location.hash.slice(1);
      this.render();
    });

    window.addEventListener("load", () => this.render());
  }

  push(path) {
    location.hash = path;
  }

  render() {
    const route = this.routes.find((r) => r.path === this.currentPath);
    if (route) {
      document.getElementById("app").innerHTML = route.component();
    }
  }
}

// 使用例
const router = new HashRouter([
  { path: "/", component: () => "<h1>ホーム</h1>" },
  { path: "/about", component: () => "<h1>アバウト</h1>" },
]);

router.push("/about");
```

## どちらを選ぶか

- **ほとんどのプロジェクト**：History モード — URL がクリーンで SEO も良いが、サーバー設定を忘れずに
- **古いブラウザのサポートが必要**：Hash モード
- **純粋な静的デプロイ**（GitHub Pages など）：Hash モード（サーバーのリダイレクト設定ができない）

## まとめ

- Hash モードは `#` の変化がサーバーへのリクエストを引き起こさないことを利用
- History モードは HTML5 の `pushState` API を利用
- History モードは必ずサーバーのフォールバックを設定する — しないとリフレッシュで 404 になる
