---
title: "GraphQL 初探：從 REST 到 GraphQL"
date: 2018-11-13 17:09:11
tags:
  - GraphQL
readingTime: 2
description: "最近在研究 GraphQL，看到很多人說它是 REST 的替代方案。試用了一下，談談我的理解。"
---

最近在研究 GraphQL，看到很多人說它是 REST 的替代方案。試用了一下，談談我的理解。

## REST 的痛點

```
GET /users/1
→ { id: 1, name, email, avatar, phone, address, preferences... }
// 返回了 50 個欄位，但頁面只需要 name 和 avatar（Over-fetching）

GET /users/1  → 使用者資訊
GET /users/1/orders → 訂單列表
GET /users/1/orders/100/items → 訂單詳情
// 一個頁面需要 3 個請求（Under-fetching）
```

## GraphQL 的解法

客戶端精確描述需要什麼資料：

```graphql
# 查詢
query GetUserWithOrders {
  user(id: 1) {
    name # 只要 name
    avatar # 只要 avatar
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

一個請求，精確返回需要的資料。

## 基礎概念

```graphql
# Schema 定義型別
type User {
  id: ID! # ! 表示非空
  name: String!
  email: String!
  orders: [Order!]
}

type Order {
  id: ID!
  total: Float!
  items: [OrderItem!]
}

# Query：讀操作
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
}

# Mutation：寫操作
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

# Subscription：即時推送
type Subscription {
  orderUpdated(userId: ID!): Order!
}
```

## 在前端使用（Apollo Client）

```javascript
import ApolloClient, { gql } from "apollo-boost";

const client = new ApolloClient({
  uri: "https://api.example.com/graphql",
  headers: {
    authorization: `Bearer ${getToken()}`,
  },
});

// 查詢
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

// 突變（寫操作）
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
  variables: { title: "標題", content: "內容" },
});
```

## 在 Vue 中使用（vue-apollo）

```javascript
// main.js
import VueApollo from "vue-apollo";
Vue.use(VueApollo);

const apolloProvider = new VueApollo({ defaultClient: client });
new Vue({ apolloProvider, render: (h) => h(App) }).$mount("#app");

// 元件
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
// 模板裡直接用 user 變數，loading、error 狀態自動管理
```

## GraphQL vs REST 的選擇

**適合 GraphQL 的場景：**

- 多端（Web/App/小程式）資料需求不同
- 資料關聯複雜，前端需要靈活組合
- 快速迭代的產品，API 變動頻繁

**繼續用 REST 的場景：**

- 簡單的 CRUD，資料結構穩定
- 團隊對 GraphQL 不熟悉
- 需要檔案上傳（GraphQL 處理麻煩）

## 小結

- GraphQL 解決了 REST 的過度獲取和多次請求問題
- 客戶端精確描述需要的資料，服務端按需返回
- Apollo Client 是目前最完善的 GraphQL 客戶端
- 不是所有專案都適合 GraphQL，評估後再引入
