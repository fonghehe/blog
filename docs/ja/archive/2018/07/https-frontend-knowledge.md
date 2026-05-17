---
title: "HTTPSの仕組みとフロントエンドに関連する知識"
date: 2018-07-31 14:48:32
tags:
  - HTTP
readingTime: 2
description: "HTTPSは現代Webの標準になっていますが、具体的にどのように動作するのか？フロントエンド開発とどう関係するのか？まとめてみました。"
---

HTTPSは現代Webの標準になっていますが、具体的にどのように動作するのか？フロントエンド開発とどう関係するのか？まとめてみました。

## HTTP vs HTTPS

```
HTTP：平文で転送。中間者はすべての内容を閲覧・改ざんできる

HTTPS = HTTP + TLS（トランスポート層セキュリティ）
  - 暗号化：中間者はデータを読めない
  - 認証：接続先のサーバーが本物であることを確認（なりすまし防止）
  - 完全性：転送中にデータが改ざんされていないことを保証
```

## TLSハンドシェイク（簡略版）

```
1. クライアント → サーバー：サポートするTLSバージョン、暗号スイートのリスト
2. サーバー → クライアント：選択された暗号スイート + デジタル証明書（公開鍵を含む）
3. クライアント：証明書の正当性を検証（CAの署名）
4. クライアント → サーバー：公開鍵で乱数を暗号化して送信
5. 双方：乱数から対称暗号化キーを生成
6. 以降の通信：対称キーで暗号化（高速）
```

## デジタル証明書

```
証明書に含まれるもの：
  - ドメイン名（あなたのWebサイトのアドレス）
  - 公開鍵
  - 発行機関（CA）
  - 有効期限
  - CAのデジタル署名

ブラウザによる証明書の検証：
  1. ドメイン名が現在アクセスしているものと一致するか
  2. 有効期限が切れていないか
  3. CAの署名が正当か（信頼されたCAが発行したか）
```

## フロントエンド開発でのHTTPS問題

**混合コンテンツ（Mixed Content）**

```html
<!-- HTTPSページからHTTPリソースを読み込む → ブラウザにブロックされる -->
<img src="http://example.com/image.jpg" />
<!-- ブロック -->
<script src="http://cdn.com/lib.js"></script>
<!-- ブロック -->

<!-- 修正：HTTPSに変更するかプロトコル相対URLを使う -->
<img src="https://example.com/image.jpg" />
<img src="//example.com/image.jpg" />
<!-- プロトコル相対：現在のページのプロトコルを自動的に使用 -->
```

**ローカル開発でのHTTPS**

```bash
# mkcertでローカルで信頼できる証明書を作成（--ignore-certificate-errorsは不要）
mkcert -install
mkcert localhost 127.0.0.1

# webpack devServerの設定
devServer: {
  https: {
    key: fs.readFileSync('./localhost-key.pem'),
    cert: fs.readFileSync('./localhost.pem')
  }
}
```

**Secure Cookie**

```javascript
// HTTPSでのみ送信されるCookie
document.cookie = "token=xxx; Secure; HttpOnly";
```

## HSTS（HTTP厳格転送セキュリティ）

```
サーバーがブラウザに伝える：これからは必ずHTTPSでアクセスしてください、HTTPは使わないで

レスポンスヘッダー：
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

ブラウザはこの指示を記憶するので、ユーザーが`http://example.com`と入力しても自動的にHTTPSに変換されます。

## 証明書の種類

```
DV（ドメイン認証）：ドメインの所有権のみ確認。数分で申請でき、無料
  - Let's Encryptはこのタイプ
  - 個人サイト、ブログに適している

OV（組織認証）：ドメイン + 組織情報を確認。数日かかる
  - 会社名が表示される。企業サイトに適している

EV（拡張認証）：最も厳格。1〜2週間かかる
  - ブラウザのアドレスバーに緑色で会社名が表示（現在ほとんどのブラウザで廃止）
  - 銀行、大規模ECサイトで使用
```

## まとめ

- HTTPS = HTTP + TLS。暗号化、認証、完全性を提供
- TLSハンドシェイク：非対称暗号化でキーを交換し、その後対称暗号化で通信
- 混合コンテンツ：HTTPSページのすべてのリソースはHTTPSである必要がある
- ローカル開発：mkcertで信頼できる証明書を生成して証明書の警告を回避
- Let's EncryptはDV証明書を無料で提供。HTTPSを使わない理由はない
