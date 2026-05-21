---
title: "RESTful API 設計規則"
date: 2018-09-10 09:32:45
tags:
  - バックエンド
readingTime: 2
description: "フロントエンドとバックエンドの連携時に API 設計の標準が統一されていないと、多くの摩擦が生じます。RESTful のコア規則を整理して、バックエンドとの認識合わせに役立てます。"
wordCount: 286
---

フロントエンドとバックエンドの連携時に API 設計の標準が統一されていないと、多くの摩擦が生じます。RESTful のコア規則を整理して、バックエンドとの認識合わせに役立てます。

## REST の核心思想

REST は Web リソースを URI として抽象化し、HTTP メソッドで操作を表します：

```
リソース：/users, /products/123, /orders
操作：
  GET     リソースを取得（データを変更しない）
  POST    リソースを作成
  PUT     リソースを全量更新
  PATCH   リソースを部分更新
  DELETE  リソースを削除
```

## URI 設計

```
✅ 良い設計（名詞の複数形、階層は従属関係を表す）：
GET    /users                   ユーザーリストを取得
GET    /users/123               ユーザー 123 を取得
POST   /users                   ユーザーを作成
PUT    /users/123               ユーザー 123 を更新（全量）
PATCH  /users/123               ユーザー 123 を更新（部分）
DELETE /users/123               ユーザー 123 を削除
GET    /users/123/orders        ユーザー 123 の注文リスト
GET    /users/123/orders/456    ユーザー 123 の注文 456

❌ 悪い設計（動詞、不統一）：
GET  /getUser
POST /createUser
GET  /user/delete?id=123
POST /updateUserInfo
```

## ステータスコードの使い方

```
2xx 成功：
  200 OK           リクエスト成功（GET、PUT、PATCH、DELETE）
  201 Created      作成成功（POST）
  204 No Content   成功だが返却内容なし（DELETE）

4xx クライアントエラー：
  400 Bad Request        リクエストパラメーターエラー
  401 Unauthorized       未ログイン（認証が必要）
  403 Forbidden          ログイン済みだが権限なし
  404 Not Found          リソースが存在しない
  409 Conflict           競合（ユーザー名が既に存在するなど）
  422 Unprocessable      パラメーター検証失敗

5xx サーバーエラー：
  500 Internal Server Error
```

## レスポンス形式

```json
// 成功レスポンス（リスト）
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}

// 成功レスポンス（単一リソース）
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 123,
    "name": "山田太郎",
    "email": "yamada@example.com"
  }
}

// エラーレスポンス
{
  "code": 40001,
  "message": "ユーザー名が既に存在します",
  "data": null
}
```

## ページネーションとフィルタリング

```
GET /users?page=1&pageSize=20              ページネーション
GET /users?status=active                   フィルタリング
GET /users?sort=createdAt&order=desc       ソート
GET /users?fields=id,name,email            フィールド選択
GET /users?keyword=山田&status=active      複合条件
```

## フロントエンドの API ラッパー

```javascript
// api/users.js
import request from "@/utils/request";

export const usersApi = {
  // リスト取得
  getList(params) {
    return request.get("/users", { params });
  },
  // 単件取得
  getById(id) {
    return request.get(`/users/${id}`);
  },
  // 作成
  create(data) {
    return request.post("/users", data);
  },
  // 更新
  update(id, data) {
    return request.patch(`/users/${id}`, data);
  },
  // 削除
  remove(id) {
    return request.delete(`/users/${id}`);
  },
};
```

## まとめ

- URI は名詞の複数形を使い、階層は従属関係を表す。動詞は使わない
- HTTP メソッドで操作を表す：GET/POST/PUT/PATCH/DELETE
- ステータスコードを意味的に使う：4xx はクライアントエラー、5xx はサーバーエラー
- レスポンスは統一フォーマット：code、message、data
- ページネーション、フィルタリングはクエリパラメーターを使う
