---
title: "GraphQL 入門：REST から GraphQL へ"
date: 2018-11-13 17:09:11
tags:
  - GraphQL
readingTime: 2
description: "最近 GraphQL を研究しています。多くの人が REST の代替と言っています。試してみて、理解をまとめます。"
wordCount: 389
---

最近 GraphQL を研究しています。多くの人が REST の代替と言っています。試してみて、理解をまとめます。

## REST の痛点

```
GET /users/1
→ { id: 1, name, email, avatar, phone, address, preferences... }
// 50 フィールドが返されたが、ページに必要なのは name と avatar のみ（Over-fetching）

GET /users/1  → ユーザー情報
GET /users/1/orders → 注文リスト
GET /users/1/orders/100/items → 注文詳細
// 1 ページで 3 リクエストが必要（Under-fetching）
```

## GraphQL の解決策

クライアントが必要なデータを正確に記述する：

```graphql
# クエリ
query GetUserWithOrders {
  user(id: 1) {
    name # name のみ
    avatar # avatar のみ
    orders(limit: 5) {
      id
      total
      items {
        name
        price
      }
    }
  }
}
```

1 リクエストで必要なデータのみを正確に返します。

## 基本概念

```graphql
# Schema で型を定義
type User {
  id: ID! # ! は非 null を意味する
  name: String!
  email: String!
  orders: [Order!]
}

type Order {
  id: ID!
  total: Float!
  items: [OrderItem!]
}

# Query：読み取り操作
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
}

# Mutation：書き込み操作
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

# Subscription：リアルタイムプッシュ
type Subscription {
  orderUpdated(userId: ID!): Order!
}
```

## フロントエンドでの使用（Apollo Client）

```javascript
import ApolloClient, { gql } from "apollo-boost";

const client = new ApolloClient({
  uri: "https://api.example.com/graphql",
  headers: {
    authorization: `Bearer ${getToken()}`,
  },
});

// クエリ
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
      avatar
    }
  }
`;

client
  .query({
    query: GET_USER,
    variables: { id: "1" },
  })
  .then(({ data }) => {
    console.log(data.user.name);
  });

// Mutation（書き込み操作）
const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!) {
    createPost(title: $title, content: $content) {
      id
      title
    }
  }
`;

client.mutate({
  mutation: CREATE_POST,
  variables: { title: "タイトル", content: "コンテンツ" },
});
```

## Vue での使用（vue-apollo）

```javascript
// main.js
import VueApollo from "vue-apollo";
Vue.use(VueApollo);

const apolloProvider = new VueApollo({ defaultClient: client });
new Vue({ apolloProvider, render: (h) => h(App) }).$mount("#app");

// コンポーネント
export default {
  apollo: {
    user: {
      query: GET_USER,
      variables() {
        return { id: this.userId };
      },
    },
  },
  props: ["userId"],
};
// テンプレートで user 変数を直接使用、loading・error 状態は自動管理
```

## GraphQL vs REST の選択

**GraphQL が適している場面：**

- マルチプラットフォーム（Web/App/ミニアプリ）でデータ要件が異なる
- データの関連が複雑で、フロントエンドが柔軟に組み合わせる必要がある
- 高速イテレーションの製品で API の変更が頻繁

**REST を継続して使う場面：**

- シンプルな CRUD でデータ構造が安定
- チームが GraphQL に慣れていない
- ファイルアップロードが必要（GraphQL は面倒）

## まとめ

- GraphQL は REST の過剰取得と複数リクエストの問題を解決する
- クライアントが必要なデータを正確に記述し、サーバーがオンデマンドで返す
- Apollo Client は現在最も完成度の高い GraphQL クライアント
- すべてのプロジェクトに GraphQL が適しているわけではない。評価してから導入する
