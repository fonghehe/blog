---
title: "GraphQL 初探：从 REST 到 GraphQL"
date: 2018-11-13 17:09:11
tags:
  - GraphQL
---

最近在研究 GraphQL，看到很多人说它是 REST 的替代方案。试用了一下，谈谈我的理解。

## REST 的痛点

```
GET /users/1
→ { id: 1, name, email, avatar, phone, address, preferences... }
// 返回了 50 个字段，但页面只需要 name 和 avatar（Over-fetching）

GET /users/1  → 用户信息
GET /users/1/orders → 订单列表
GET /users/1/orders/100/items → 订单详情
// 一个页面需要 3 个请求（Under-fetching）
```

## GraphQL 的解法

客户端精确描述需要什么数据：

```graphql
# 查询
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

一个请求，精确返回需要的数据。

## 基础概念

```graphql
# Schema 定义类型
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

# Query：读操作
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
}

# Mutation：写操作
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

# Subscription：实时推送
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

// 查询
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

// 突变（写操作）
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
  variables: { title: "标题", content: "内容" },
});
```

## 在 Vue 中使用（vue-apollo）

```javascript
// main.js
import VueApollo from "vue-apollo";
Vue.use(VueApollo);

const apolloProvider = new VueApollo({ defaultClient: client });
new Vue({ apolloProvider, render: (h) => h(App) }).$mount("#app");

// 组件
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
// 模板里直接用 user 变量，loading、error 状态自动管理
```

## GraphQL vs REST 的选择

**适合 GraphQL 的场景：**

- 多端（Web/App/小程序）数据需求不同
- 数据关联复杂，前端需要灵活组合
- 快速迭代的产品，API 变动频繁

**继续用 REST 的场景：**

- 简单的 CRUD，数据结构稳定
- 团队对 GraphQL 不熟悉
- 需要文件上传（GraphQL 处理麻烦）

## 小结

- GraphQL 解决了 REST 的过度获取和多次请求问题
- 客户端精确描述需要的数据，服务端按需返回
- Apollo Client 是目前最完善的 GraphQL 客户端
- 不是所有项目都适合 GraphQL，评估后再引入
