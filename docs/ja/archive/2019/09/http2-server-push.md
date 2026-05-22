---
title: "HTTP/2 Server Push：原理と実践"
date: 2019-09-12 11:02:48
tags:
  - フロントエンド
readingTime: 7
description: "HTTP/2 は多重化、ヘッダー圧縮、サーバープッシュなどの重要な改善をもたらしました。中でも Server Push は、サーバーがクライアントの要求前にリソースを能動的にプッシュすることを可能にし、リクエストのラウンドトリップ回数を減らし、ページの読み込み速度を大幅に向上させます。この記事では HTTP/2 Server Push の動作原理を詳しく解説し、Node.js と Nginx を用いた実践的な設定を紹介します。"
wordCount: 1609
---

HTTP/2 はマルチプレックス、ヘッダー圧縮、サーバープッシュなどの重要な改善をもたらしました。中でも Server Push は、サーバーがクライアントの要求前にリソースを能動的にプッシュすることを可能にし、リクエストのラウンドトリップ回数を減らし、ページの読み込み速度を大幅に向上させます。この記事では HTTP/2 Server Push の動作原理を詳しく解説し、Node.js と Nginx を用いた実践的な設定を紹介します。

## HTTP/1.1のリソース読み込みのボトルネック

HTTP/1.1 では、ブラウザが HTML を解析した後、CSS/JS のロードが必要になって初めて新しいリクエストが発生します：

```
浏览器                          服务器
  |---- 请求 index.html -------->|  (第 1 次往返)
  |<---- 返回 index.html --------|
  |
  |---- 请求 style.css --------->|  (第 2 次往返)
  |<---- 返回 style.css ---------|
  |
  |---- 请求 app.js ------------>|  (第 3 次往返)
  |<---- 返回 app.js ------------|
```

毎回のラウンドトリップにはネットワーク遅延（RTT）が発生し、リソースが増えるほど待機時間が長くなります。

## HTTP/2 Server Pushの仕組み

Server Push により、サーバーは HTML のレスポンス時に関連する CSS/JS を能動的にプッシュできます：

```
浏览器                          服务器
  |---- 请求 index.html -------->|
  |<---- 返回 index.html --------|
  |<---- 推送 style.css ---------|  (服务器主动推送)
  |<---- 推送 app.js ------------|  (服务器主动推送)
```

2 回分のラウンドトリップ時間を節約できます！

### 技術的な詳細

Server Push は HTTP/2 の `PUSH_PROMISE` フレームを使用します：

1. サーバーが `index.html` へのリクエストを受信
2. サーバーが `PUSH_PROMISE` フレームを送信し、`style.css` をプッシュすることをクライアントに通知
3. クライアントはキャッシュを確認し、既にリソースがある場合は `RST_STREAM` を送信してプッシュを拒否
4. クライアントが必要とする場合、サーバーがリソースデータを送信

### 重要な概念

- **プッシュキャッシュ（Push Cache）** — プッシュされたリソースは特別な HTTP/2 Push Cache に一時的に保存され、ブラウザが実際にそのリソースを必要とする場合にのみ使用されます
- **プッシュは拒否可能** — クライアントが既にキャッシュを持っている場合、サーバーのプッシュを拒否できます
- **プッシュはリクエストに関連付けられる** — プッシュされたリソースは、プッシュをトリガーしたリクエストに関連付けられます

## NginxのServer Push設定

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        root /var/www/html;
        index index.html;

        # Server Push 設定
        http2_push /static/css/style.css;
        http2_push /static/js/vendor.js;
        http2_push /static/js/app.js;
    }

    # 也可以通过 Link header 触发推送
    location = / {
        root /var/www/html;
        add_header Link "</static/css/style.css>; rel=preload; as=style";
        add_header Link "</static/js/vendor.js>; rel=preload; as=script";
    }
}
```

### Link header を使用した動的プッシュ

Nginx はレスポンスヘッダーの `Link` フィールドを介してプッシュをトリガーできます：

```nginx
# 基于请求路径动态决定推送内容
location / {
    # リクエストパスに基づいてプッシュ内容を動的に決定
    set $push_headers "";

    # トップページはファーストビューの重要なリソースをプッシュ
    if ($uri = "/") {
        add_header Link "</static/css/home.css>; rel=preload; as=style";
        add_header Link "</static/js/home.js>; rel=preload; as=script";
    }

    # 記事ページは記事関連のリソースをプッシュ
    if ($uri ~ "^/posts/") {
        add_header Link "</static/css/post.css>; rel=preload; as=style";
    }
}
```

## Node.jsでServer Pushを実装する

### ネイティブ http2 モジュール

```js
const http2 = require('http2');
const fs = require('fs');
const path = require('path');

const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_STATUS,
} = http2.constants;

const server = http2.createSecureSession({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
});

const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http2.createSecureServer({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
});

server.on('stream', (stream, headers) => {
  const reqPath = headers[HTTP2_HEADER_PATH];

  if (reqPath === '/' || reqPath === '/index.html') {
    // 重要なリソースをプッシュ
    pushResource(stream, '/static/css/style.css', {
      [HTTP2_HEADER_PATH]: '/static/css/style.css',
    });

    pushResource(stream, '/static/js/app.js', {
      [HTTP2_HEADER_PATH]: '/static/js/app.js',
    });

    // 响应 HTML
    stream.respondWithFile(
      path.join(PUBLIC_DIR, 'index.html'),
      { 'content-type': 'text/html; charset=utf-8' }
    );
  } else {
    // その他のリソースは通常通りレスポンス
    const filePath = path.join(PUBLIC_DIR, reqPath);
    stream.respondWithFile(filePath);
  }
});

function pushResource(parentStream, reqPath, pushHeaders) {
  parentStream.pushStream(pushHeaders, (err, pushStream) => {
    if (err) {
      console.error('プッシュ失敗:', err);
      return;
    }

    const filePath = path.join(PUBLIC_DIR, reqPath);
    const ext = path.extname(filePath);
    const contentType = getContentType(ext);

    pushStream.respondWithFile(filePath, {
      'content-type': contentType,
    });
  });
}

function getContentType(ext) {
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

server.listen(8443, () => {
  console.log('HTTPS/2 Server が https://localhost:8443 で実行中');
});
```

### Express + express-http2-push

```js
const express = require('express');
const http2 = require('http2');
const fs = require('fs');
const push = require('express-http2-push');

const app = express();

// ミドルウェア：指定されたリソースを自動プッシュ
app.use(push({
  '/': [
    '/static/css/style.css',
    '/static/js/vendor.js',
    '/static/js/app.js',
  ],
  '/dashboard': [
    '/static/css/dashboard.css',
    '/static/js/dashboard.js',
  ],
}));

app.use(express.static('public'));

const server = http2.createSecureServer({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
  allowHTTP1: true, // HTTP/1.1 へのフォールバック
});

server.on('request', app);
server.listen(8443);
```

## どのリソースをプッシュすべきか判断する

すべてのリソースがプッシュに適しているわけではありません。プッシュに適したリソースの特徴：

1. **クリティカルレンダリングパスのリソース** — ファーストビューの CSS、ファーストビューの JS
2. **サイズが小さい** — 大きなファイルをプッシュするとメインレスポンスがブロックされる
3. **そのページで必ず使用される** — 他の条件でスキップされない

### クリティカルリソースの分析

```js
// Lighthouse を使用してクリティカルリクエストチェーンを取得
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function getCriticalResources(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse(url, options);
  const audits = runnerResult.lhr.audits;

  // クリティカルリクエストチェーンを取得
  const criticalRequestChain = audits['critical-request-chains'];
  console.log('クリティカルリクエストチェーン:', criticalRequestChain);

  // ファーストビューのクリティカルリソースを取得
  const renderBlocking = audits['render-blocking-resources'];
  console.log('レンダリングをブロックするリソース:', renderBlocking);

  await chrome.kill();
}

getCriticalResources('https://example.com');
```

## プッシュキャッシュとクライアントキャッシュの相互作用

### 問題：重複プッシュ

クライアントが既にキャッシュを持っている場合でもサーバーがプッシュすると、帯域幅を浪費します：

```
客户端已有 style.css 缓存
服务器仍然推送 style.css
客户端收到 PUSH_PROMISE 后拒绝（但推送数据已经发出了一部分）
```

### 解決策：Cookie を使用したキャッシュ追跡

```nginx
# Cookie に基づいてプッシュの必要性を判断
map $cookie_pushed_resources $need_push_css {
    default 1;
    "~style\.css" 0;
}

location / {
    if ($need_push_css) {
        http2_push /static/css/style.css;
    }

    # Cookie を設定してプッシュ済みリソースを記録
    add_header Set-Cookie "pushed_resources=style.css; Path=/; Max-Age=86400";
}
```

### より洗練された方法：103 Early Hints

HTTP/2 Server Push の代替案として 103 Early Hints があります：

```js
// Node.js 实现 103 Early Hints
server.on('stream', (stream, headers) => {
  // 最初に 103 Early Hints を送信
  stream.additionalHeaders({
    ':status': '103',
    'link': '</static/css/style.css>; rel=preload; as=style',
  });

  // その後、通常通りレスポンス
  setTimeout(() => {
    stream.respondWithFile('./index.html', {
      'content-type': 'text/html',
    });
  }, 100);
});
```

103 Early Hints により、クライアントはサーバーがリクエストを処理している間にリソースをプリロードでき、サーバーが何をプッシュするかを決定する必要がありません。

## Server Pushの注意事項

1. **過剰なプッシュを避ける** — リソースをプッシュしすぎるとメインレスポンスがブロックされる
2. **既存のキャッシュを考慮する** — キャッシュ済みのリソースをプッシュするのは無駄
3. **Push Cache のライフサイクルは短い** — 未使用のプッシュリソースは接続終了後に破棄される
4. **HTTPS が必要** — HTTP/2 Server Push は HTTPS でのみ利用可能
5. **実際の効果を測定する** — ネットワーク条件によって効果が異なるため、RUM データで検証する必要がある

## まとめ

- HTTP/2 Server Push は `PUSH_PROMISE` フレームを使用してクライアントのリクエスト前にリソースを能動的にプッシュし、RTT を削減します
- プッシュに適したリソース：クリティカルレンダリングパスのリソース、サイズが小さい、そのページで必ず使用されるもの
- Nginx の設定は簡単（`http2_push`）、Node.js では http2 モジュールを使用して手動実装
- プッシュキャッシュ（Push Cache）は通常のキャッシュとは独立しており、ライフサイクルが短い
- 既にキャッシュされたリソースの重複プッシュを避ける必要があります
- 103 Early Hints は Server Push の軽量な代替案であり、クライアントが自らプリロードするかどうかを決定できます
- RUM データを使用して Server Push の実際のパフォーマンス効果を検証することが重要です
