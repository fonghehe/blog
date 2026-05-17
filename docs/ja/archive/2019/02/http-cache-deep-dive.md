---
title: "HTTPキャッシュ深掘り：強キャッシュと協議キャッシュ"
date: 2019-02-23 10:46:09
tags:
  - フロントエンド
readingTime: 1
description: "HTTPキャッシュはフロントエンドパフォーマンス最適化の重要な要素だが、強キャッシュと協議キャッシュの違いを理解していない開発者が多く、キャッシュが効かなかったり更新が遅延したりする問題が起きる。"
---

HTTPキャッシュはフロントエンドパフォーマンス最適化の重要な要素だが、強キャッシュと協議キャッシュの違いを理解していない開発者が多く、キャッシュが効かなかったり更新が遅延したりする問題が起きる。

## キャッシュのフロー

```
リソースをリクエスト
  ↓
ブラウザにキャッシュがある？
  → なし：サーバーに直接リクエスト
  → あり：強キャッシュを確認（Cache-Control / Expires）
       → 未期限切れ：キャッシュを使用（200 from cache）
       → 期限切れ：協議キャッシュ（If-None-Match / If-Modified-Sinceを付けてリクエスト）
                 → サーバーが304を返す：ローカルキャッシュを使用
                 → サーバーが200を返す：新しいリソースを使用
```

## 強キャッシュ

```http
# レスポンスヘッダー
Cache-Control: max-age=31536000  # 1年間キャッシュ（秒単位）
Cache-Control: no-cache          # 強キャッシュを使わない（協議はする）
Cache-Control: no-store          # まったくキャッシュしない
Cache-Control: private           # ブラウザのみキャッシュ、CDNはキャッシュしない
Cache-Control: public            # CDNがキャッシュ可能
Expires: Wed, 23 Feb 2020 00:00:00 GMT  # 旧式の書き方、サーバー時刻が基準
```

`Cache-Control`は`Expires`より優先される。モダンなプロジェクトでは`Cache-Control`を使う。

## 協議キャッシュ

```http
# レスポンスヘッダー（初回リクエスト）
ETag: "abc123"                         # リソースの一意識別子（コンテンツハッシュ）
Last-Modified: Tue, 22 Feb 2019 10:00:00 GMT

# リクエストヘッダー（再リクエスト、強キャッシュ期限切れ後）
If-None-Match: "abc123"               # 前回のETag
If-Modified-Since: Tue, 22 Feb 2019 10:00:00 GMT

# サーバーレスポンス：変化なし
HTTP/1.1 304 Not Modified             # ブラウザはローカルキャッシュを使用
# サーバーレスポンス：変化あり
HTTP/1.1 200 OK + 新しいリソース
```

`ETag`はより精度が高い（コンテンツレベル）、`Last-Modified`は秒単位の精度。ETagを推奨する。

## 静的リソースのキャッシュ戦略

```nginx
# nginx設定例

# HTML：キャッシュなし（最新のエントリーファイルを確保するため協議キャッシュを使用）
location ~* \.html$ {
  add_header Cache-Control "no-cache";
  add_header ETag "";
}

# ハッシュ付きJS/CSS：長期キャッシュ
# （コンテンツが変わるとハッシュが変わり、ファイル名が変わり、自動的に更新される）
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# 画像：1ヶ月
location ~* \.(jpg|png|gif|webp|svg)$ {
  add_header Cache-Control "public, max-age=2592000";
}

# フォント：1年
location ~* \.(woff2|woff|ttf)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## WebpackのHash設定

```javascript
// webpack.config.js（本番）
module.exports = {
  output: {
    filename: "[name].[contenthash:8].js", // コンテンツハッシュ
    chunkFilename: "[name].[contenthash:8].chunk.js",
  },
  optimization: {
    // vendorのハッシュを安定させる（依存関係が変わった時のみ変化）
    moduleIds: "hashed",
    runtimeChunk: "single", // runtimeを個別バンドル化し他のchunkのhashへの影響を避ける
    splitChunks: {
      cacheGroups: {
        vendor: {
```
