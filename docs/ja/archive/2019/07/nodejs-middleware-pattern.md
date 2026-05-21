---
title: "Node.js ミドルウェアパターン詳解"
date: 2019-07-24 11:19:10
tags:
  - JavaScript
readingTime: 2
description: "ミドルウェアパターンは Node.js における基本的なデザインパターンで、Express.js が最良の例です。関数のチェーンを通じてリクエスト/レスポンス処理を組み合わせることができます。"
wordCount: 399
---

ミドルウェアパターンは Node.js における基本的なデザインパターンで、Express.js が最良の例です。関数のチェーンを通じてリクエスト/レスポンス処理を組み合わせることができます。

## ミドルウェアとは

ミドルウェア関数はリクエストオブジェクト（`req`）、レスポンスオブジェクト（`res`）、そして `next` 関数にアクセスできます：

```javascript
function middleware(req, res, next) {
  // req/res を処理
  next(); // 次のミドルウェアに制御を渡す
}
```

## シンプルなミドルウェアシステムの構築

```javascript
class App {
  constructor() {
    this.middlewares = [];
  }

  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  run(req, res) {
    const dispatch = (index) => {
      if (index >= this.middlewares.length) return;
      const fn = this.middlewares[index];
      fn(req, res, () => dispatch(index + 1));
    };
    dispatch(0);
  }
}
```

## Koa スタイルの非同期ミドルウェア

Koa は「オニオンモデル」を使います——ミドルウェアは `await next()` でき、下流のミドルウェアが全て完了した後に実行を再開できます：

```javascript
function compose(middlewares) {
  return function (ctx) {
    let index = -1;

    function dispatch(i) {
      if (i <= index)
        return Promise.reject(new Error("next() が複数回呼ばれました"));
      index = i;

      if (i >= middlewares.length) return Promise.resolve();

      const fn = middlewares[i];
      return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
    }

    return dispatch(0);
  };
}

// 使用例
const middlewares = [
  async (ctx, next) => {
    console.log("middleware 1 開始");
    await next();
    console.log("middleware 1 終了");
  },
  async (ctx, next) => {
    console.log("middleware 2 開始");
    await next();
    console.log("middleware 2 終了");
  },
  async (ctx) => {
    console.log("middleware 3（最終）");
  },
];

// 出力:
// middleware 1 開始
// middleware 2 開始
// middleware 3（最終）
// middleware 2 終了
// middleware 1 終了
```

## よく使われるミドルウェアパターン

### ログミドルウェア

```javascript
function logger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`,
    );
  });
  next();
}
```

### 認証ミドルウェア

```javascript
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "無効なトークン" });
  }
}
```

### エラーハンドリングミドルウェア

```javascript
// Express のエラーミドルウェアは引数が4つ
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production" ? "サーバーエラー" : err.message,
  });
}

app.use(errorHandler); // 最後に登録する必要がある
```

## まとめ

- ミドルウェアは関数チェーンで、各関数がリクエスト/レスポンスを処理し、任意で `next()` を呼び出す
- Express はリニアモデル、Koa はオニオンモデル（`next()` の前後両方のコードが実行される）
- よくあるパターン：ログ、認証、エラーハンドリング、レート制限
- ミドルウェアの登録順序が重要——登録された順番で実行される
