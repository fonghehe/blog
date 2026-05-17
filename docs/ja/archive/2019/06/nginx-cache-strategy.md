---
title: "Nginxフロントエンドキャッシュ戦略設定実践"
date: 2019-06-17 17:13:38
tags:
  - エンジニアリング
readingTime: 1
description: "フロントエンドのパフォーマンス最適化は圧縮やコード分割から始まることが多いですが、ブラウザキャッシュも高い効果が期待できるエリアです。適切なNginxキャッシュ設定はサーバーへの負荷を大幅に削減し、再訪問時のロード時間を著しく改善できます。"
---

フロントエンドのパフォーマンス最適化は圧縮やコード分割から始まることが多いですが、ブラウザキャッシュも高い効果が期待できるエリアです。適切なNginxキャッシュ設定はサーバーへの負荷を大幅に削減し、再訪問時のロード時間を著しく改善できます。

## ブラウザキャッシュの基礎

ブラウザキャッシュの判断フロー：

```
リソースをリクエスト
     ↓
ローカルキャッシュがある？
  ├── ない → サーバーから取得
  └── ある
        ↓
     キャッシュが期限切れ？
       ├── いいえ → ローカルキャッシュを使用（200 from cache）
       └── はい
             ↓
          条件付きリクエストを送信（If-None-Match / If-Modified-Since）
            ├── サーバー: 変更なし → 304 Not Modified（キャッシュを使用）
            └── サーバー: 変更あり → 200 + 新しいリソース
```

## Nginxのexpiresディレクティブ

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/html;

    # HTML: キャッシュなし（常に最新を取得）
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # ハッシュ付き静的アセット: 永続キャッシュ（Webpackハッシュで一意性を保証）
    # 例: main.a1b2c3d4.js、app.5e6f7g8h.css
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 画像: 長いキャッシュ
    location ~* \.(png|jpg|jpeg|gif|webp|svg|ico)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # フォント: 永続キャッシュ
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}
```

## 細かいCache-Controlの制御

```nginx
# Cache-Controlヘッダーの参考:
# public   — 中間/プロキシがキャッシュ可能
# private  — ユーザーのブラウザのみキャッシュ可（プロキシ不可）
# no-cache — キャッシュ使用前にサーバーでの再検証が必要
# no-store — キャッシュを一切保存しない
# max-age  — 期限切れまでの秒数
# immutable — ファイルコンテンツが変わらないため再検証不要

# APIレスポンス: キャッシュなし（動的データ）
location /api/ {
    proxy_pass http://backend;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Vary "Authorization";  # ユーザーごとに異なるキャッシュ
}
```

## 実践的なフロントエンドビルド戦略

Webpackのコンテンツハッシュと組み合わせて最大の効果を得る：

```
dist/
├── index.html          → no-cache（毎回再取得）
├── js/
│   ├── app.a1b2c3.js   → 1年キャッシュ（コンテンツ変更時にハッシュが変わる）
│   └── vendor.d4e5f6.js → 1年キャッシュ
└── css/
    └── app.g7h8i9.css   → 1年キャッシュ
```

コア戦略：**HTMLはキャッシュしない；それ以外はハッシュでキャッシュ**。
