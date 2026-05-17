---
title: "フロントエンド Mock データ方法の比較"
date: 2018-09-17 10:58:04
tags:
  - フロントエンド
readingTime: 3
description: "フロントエンドとバックエンドを並行開発する際、フロントエンドは Mock データが必要です。いくつかの方法を使ってきたので、それぞれのメリット・デメリットを整理します。"
---

フロントエンドとバックエンドを並行開発する際、フロントエンドは Mock データが必要です。いくつかの方法を使ってきたので、それぞれのメリット・デメリットを整理します。

## 方法1：コードにハードコード（最も簡単、最も悪い）

```javascript
// ❌ あちこちに固定データがあり、メンテナンスしにくい
async function getUsers() {
  if (process.env.NODE_ENV === "development") {
    return [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
  }
  return fetch("/api/users").then((r) => r.json());
}
```

## 方法2：ローカル JSON ファイル

```javascript
// mock/users.json
// src/api/index.js
import usersData from "@/mock/users.json";

async function getUsers() {
  if (process.env.VUE_APP_MOCK === "true") {
    return usersData;
  }
  return request.get("/api/users");
}
```

シンプルですが、遅延やエラーをシミュレートできません。

## 方法3：Mock.js

Mock.js はランダムデータを生成し、XMLHttpRequest をインターセプトできます：

```javascript
// npm install mockjs

import Mock from "mockjs";

// GET /api/users をインターセプトしてランダムデータを返す
Mock.mock("/api/users", "get", {
  code: 0,
  "data|10": [
    {
      // 10件のデータを生成
      "id|+1": 1, // 自動インクリメント id
      name: "@cname", // ランダムな日本語名
      email: "@email", // ランダムなメールアドレス
      "age|18-60": 1, // 18-60 のランダムな整数
      avatar: '@image("100x100")',
    },
  ],
});

// URL に正規表現でマッチ
Mock.mock(/\/api\/users\/\d+/, "get", {
  code: 0,
  data: {
    id: "@id",
    name: "@cname",
    email: "@email",
  },
});
```

## 方法4：JSON Server

独立した REST API サービス。JSON ファイルを読み込み、CRUD をサポートします：

```bash
npm install -g json-server

# db.json
{
  "users": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" }
  ],
  "posts": []
}

# 起動（ポート 3000）
json-server --watch db.json --port 3000
```

自動的に生成されるエンドポイント：

- `GET /users` → リスト取得
- `GET /users/1` → 単件取得
- `POST /users` → 作成
- `PUT /users/1` → 更新
- `DELETE /users/1` → 削除

devServer.proxy で転送するように設定します。

## 方法5：MSW（Mock Service Worker）

2018 年に登場した新しい方法。Service Worker を通じてブラウザ層でリクエストをインターセプトします：

```javascript
// src/mocks/handlers.js
import { rest } from "msw";

export const handlers = [
  rest.get("/api/users", (req, res, ctx) => {
    return res(
      ctx.delay(200), // 遅延をシミュレート
      ctx.json({
        code: 0,
        data: [{ id: 1, name: "Alice" }],
      }),
    );
  }),

  rest.post("/api/users", (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({ code: 0, data: { id: 3, ...req.body } }),
    );
  }),
];
```

メリット：ビジネスコードを変更不要。実際のネットワークリクエストとして DevTools の Network で確認できます。

## 比較

| 方法          | 難度       | ランダムデータ | 遅延/エラーシミュレート | コード変更                 |
| ------------- | ---------- | -------------- | ----------------------- | -------------------------- |
| ハードコード  | 非常に簡単 | ❌             | ❌                      | あり                       |
| JSON ファイル | 簡単       | ❌             | ❌                      | あり                       |
| Mock.js       | 中程度     | ✅             | 限定的                  | なし（XHR インターセプト） |
| JSON Server   | 中程度     | ❌             | ❌                      | なし（プロキシ）           |
| MSW           | 中程度     | ✅             | ✅                      | なし                       |

## 私たちのやり方

`vue.config.js` で、開発環境では環境変数によって Mock.js を有効にするか決めます：

```javascript
// 開発環境のみ mock を読み込む
if (process.env.VUE_APP_MOCK === "true") {
  require("./src/mock");
}
```

## まとめ

- 小規模プロジェクト：Mock.js + ランダムデータで十分
- バックエンドのデータ構造に合わせる必要がある場合：JSON Server
- ユニット/インテグレーションテスト：MSW がベストプラクティス
- どの方法でも、Mock コードを本番バンドルに含めない（tree-shaking または条件分岐で読み込む）
