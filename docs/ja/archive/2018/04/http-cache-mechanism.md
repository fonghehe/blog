---
title: "HTTP キャッシュの仕組み：強キャッシュとネゴシエーションキャッシュ"
date: 2018-04-25 16:13:17
tags:
  - フロントエンド
readingTime: 3
description: "HTTP キャッシュを正しく設定するとページ読み込みパフォーマンスが大幅に向上しますが、設定を誤るとユーザーが最新コンテンツを見られなくなります。仕組みを理解した上で適切な判断を下しましょう。"
wordCount: 839
---

HTTP キャッシュを正しく設定するとページ読み込みパフォーマンスが大幅に向上しますが、設定を誤るとユーザーが最新コンテンツを見られなくなります。仕組みを理解した上で適切な判断を下しましょう。

## 2 種類のキャッシュ

```
ブラウザがリクエスト
    ↓
キャッシュがある？ → ない → サーバーへリクエスト → キャッシュ保存 → 返却
    ↓ ある
強キャッシュが有効？ → はい → キャッシュを直接使用（サーバーへリクエストなし）200 from cache
    ↓ いいえ
サーバーへネゴシエーションリクエスト → 変更なし → 304 Not Modified、キャッシュ使用
                                      → 変更あり → 200、新しいコンテンツ
```

## 強キャッシュ

ブラウザがキャッシュの有効性を確認し、有効であれば**サーバーへのリクエストなし**でキャッシュを直接使用します。

### Cache-Control（HTTP/1.1、優先）

```
# サーバーのレスポンスヘッダー
Cache-Control: max-age=31536000   # 1年間キャッシュ（秒単位）
Cache-Control: no-cache           # 強キャッシュを使わないが、ネゴシエーションキャッシュは可
Cache-Control: no-store           # 一切キャッシュしない
Cache-Control: private            # ブラウザのみキャッシュ可、CDN は不可
Cache-Control: public             # ブラウザと CDN の両方がキャッシュ可
```

### Expires（HTTP/1.0、優先度低）

```
Expires: Thu, 01 Jan 2019 00:00:00 GMT   # 有効期限（絶対時刻）
```

欠点：クライアントの時計に依存するため、時刻がずれていると問題が発生します。`Cache-Control` に置き換えられました。

## ネゴシエーションキャッシュ

ブラウザがキャッシュの識別子をサーバーに送り、サーバーがリソースの変更有無を判断します。

### Last-Modified / If-Modified-Since

```
# 初回リクエスト — サーバーのレスポンス
Last-Modified: Mon, 01 Jan 2018 10:00:00 GMT

# 次回以降のリクエスト — ブラウザが送信
If-Modified-Since: Mon, 01 Jan 2018 10:00:00 GMT

# サーバーの判断：リソース変更なし
HTTP/1.1 304 Not Modified

# サーバーの判断：リソースが変更された
HTTP/1.1 200 OK
Last-Modified: Mon, 15 Jan 2018 09:30:00 GMT
[新しいコンテンツ]
```

**欠点**：精度が秒単位のため、1 秒以内の複数回の変更を検出できません。

### ETag / If-None-Match（より正確）

```
# 初回リクエスト — サーバーのレスポンス
ETag: "abc123"  # コンテンツのハッシュ値

# 次回以降のリクエスト
If-None-Match: "abc123"

# サーバーが ETag を比較
HTTP/1.1 304 Not Modified  # または 200 + 新しい ETag
```

ETag はコンテンツのダイジェストであり、内容が変わると ETag も変わります。`Last-Modified` より正確です。

## フロントエンドアセットの最適なキャッシュ戦略

### HTML ファイル：キャッシュなし、またはネゴシエーションキャッシュ

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache";
}
```

理由：HTML はエントリーポイントであり、即座に更新される必要があります。ユーザーが常に最新の JS/CSS ファイル名を取得できるようにします。

### ハッシュ付き JS/CSS：強キャッシュを最大化

```nginx
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Webpack はコンテンツハッシュ付きのファイル名でビルドします：

```javascript
// webpack.config.js
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

`app.a1b2c3d4.js` はコンテンツが変わらない限りハッシュ（＝キャッシュ）も変わりません。コンテンツが変わればファイル名も変わり（自動的にキャッシュが無効化）、1年間の強キャッシュを安心して設定できます。

### 画像とフォント

```nginx
location ~* \.(jpg|jpeg|png|gif|svg|woff2|ttf)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30日
}
```

## Vue CLI / Webpack の正しい設定

```javascript
// vue.config.js
module.exports = {
  filenameHashing: true, // デフォルトで有効

  chainWebpack: (config) => {
    // index.html をキャッシュしないようにする
    config.plugin("html").tap((args) => {
      args[0].cache = false;
      return args;
    });
  },
};
```

## キャッシュが効いているか確認する

Chrome DevTools → Network パネル：

- `200 (from memory cache)` — 強キャッシュ（メモリ）
- `200 (from disk cache)` — 強キャッシュ（ディスク）
- `304 Not Modified` — ネゴシエーションキャッシュヒット
- `200` — キャッシュミス、サーバーから取得

**Size 列が 0** であればキャッシュが使用され、実際のデータ転送は発生していません。

## まとめ

- HTML には強キャッシュを使わず、`no-cache` で毎回検証する
- JS/CSS にはコンテンツハッシュ付きのファイル名を使い、最長の強キャッシュを設定して問題ない
- ネゴシエーションキャッシュの ETag は `Last-Modified` より正確
- Webpack の `contenthash` が正しいキャッシュ無効化の鍵
