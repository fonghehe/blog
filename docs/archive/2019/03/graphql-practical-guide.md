---
title: "GraphQL 实战：从 REST 迁移的真实体验"
date: 2019-03-16 09:35:25
tags:
  - GraphQL
readingTime: 2
description: "团队做了一个新项目，试了 GraphQL。用了两个月，说说真实感受——不是都好，也不是都不好。"
wordCount: 394
---

团队做了一个新项目，试了 GraphQL。用了两个月，说说真实感受——不是都好，也不是都不好。

## 为什么要试 GraphQL

原来的 REST API 有几个痛点：

1. 过多/过少数据：前端要的字段和接口返回的不一致，要么多余要么缺
2. 接口数量爆炸：一个页面要调 5-6 个接口
3. 接口文档维护麻烦

GraphQL 的核心思路：前端决定要什么数据。

## 基础查询

```graphql
# 查询语言
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    orders(first: 5) {   # 关联数据，一次查询
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

# 变量
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

## Mutation：修改数据

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
  const [createOrder, { loading }] = useMutation(CREATE_ORDER, {
    // 更新缓存（避免重新查询）
    update(cache, { data: { createOrder } }) {
      cache.modify({
        fields: {
          orders(existingOrders = []) {
            return [createOrder, ...existingOrders];
          },
        },
      });
    },
    onCompleted: () => toast.success("下单成功"),
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (formData) => {
    createOrder({ variables: { input: formData } });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Apollo Client 缓存

GraphQL 最大的优势之一：客户端缓存。

```javascript
// Apollo 会自动规范化缓存（根据 __typename + id）
// 同一个对象在多个查询中共享缓存
// 一个地方更新，所有引用该对象的查询自动更新

const client = new ApolloClient({
  uri: "/graphql",
  cache: new InMemoryCache({
    typePolicies: {
      User: {
        keyFields: ["id"], // 缓存 key
      },
      Query: {
        fields: {
          // 分页策略
          orders: relayStylePagination(),
        },
      },
    },
  }),
});
```

## 真实体验：好与不好

**好的地方：**

- 一次查询获取所有需要的数据，瀑布请求减少很多
- 类型系统 + 自动生成类型定义（配合 graphql-code-generator）
- Apollo DevTools 让调试变得直观

**麻烦的地方：**

- 后端学习成本高（N+1 问题需要 DataLoader 解决）
- 错误处理比 REST 复杂（GraphQL 永远返回 200，错误在响应体里）
- 文件上传比 REST 麻烦
- CDN 缓存不好做（POST 请求）

**结论：** 数据关系复杂、前端团队强、愿意投入学习成本的项目值得用。简单的 CRUD 系统用 REST 更省事。

## 小结

- GraphQL 让前端按需获取数据，解决了过度/不足获取的问题
- Apollo Client 自动管理缓存，减少不必要的请求
- N+1 问题是 GraphQL 后端最常见的性能坑，用 DataLoader 解决
- 技术选型要看场景，不要为了用 GraphQL 而用 GraphQL
