---
title: "GraphQL実践：RESTから移行した実際の体験"
date: 2019-03-16 09:35:25
tags:
  - GraphQL
readingTime: 1
description: "チームで新しいプロジェクトにGraphQLを試した。2ヶ月使ってみた正直な感想——全て良いわけでも、全て悪いわけでもない。"
---

チームで新しいプロジェクトにGraphQLを試した。2ヶ月使ってみた正直な感想——全て良いわけでも、全て悪いわけでもない。

## なぜGraphQLを試したのか

以前のREST APIにはいくつかの痛点があった：

1. オーバーフェッチ/アンダーフェッチ：フロントエンドが必要なフィールドとAPIが返すものが一致しない——多すぎるか少なすぎるか
2. エンドポイントの爆発：1つのページで5〜6回のAPI呼び出しが必要
3. APIドキュメントのメンテナンスが面倒

GraphQLのコアアイデア：フロントエンドが欲しいデータを決める。

## 基本クエリ

```graphql
# クエリ言語
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    orders(first: 5) {   # 関連データを一度のクエリで取得
      id
      total
      status
      items {
        name
        quantity
      }
    }
  }
}

# 変数
{
  "id": "user-123"
}
```

```javascript
// React + Apollo Client
import { useQuery, gql } from "@apollo/client";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      orders(first: 5) {
        id
        total
      }
    }
  }
`;

function UserProfile({ userId }) {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return <div>{data.user.name}</div>;
}
```

## ミューテーション：データの変更

```graphql
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    id
    status
    total
  }
}
```

```javascript
import { useMutation } from "@apollo/client";

const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      status
    }
  }
`;

function OrderForm() {
```
