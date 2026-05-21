---
title: "GraphQL 實戰：從 REST 遷移的真實體驗"
date: 2019-03-16 09:35:25
tags:
  - GraphQL
readingTime: 2
description: "團隊做了一個新項目，試了 GraphQL。用了兩個月，説説真實感受——不是都好，也不是都不好。"
wordCount: 394
---

團隊做了一個新項目，試了 GraphQL。用了兩個月，説説真實感受——不是都好，也不是都不好。

## 為什麼要試 GraphQL

原來的 REST API 有幾個痛點：

1. 過多/過少數據：前端要的字段和接口返回的不一致，要麼多餘要麼缺
2. 接口數量爆炸：一個頁面要調 5-6 個接口
3. 接口文檔維護麻煩

GraphQL 的核心思路：前端決定要什麼數據。

## 基礎查詢

```graphql
# 查詢語言
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    orders(first: 5) {   # 關聯數據，一次查詢
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

# 變量
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

## Mutation：修改數據

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
    // 更新緩存（避免重新查詢）
    update(cache, { data: { createOrder } }) {
      cache.modify({
        fields: {
          orders(existingOrders = []) {
            return [createOrder, ...existingOrders];
          },
        },
      });
    },
    onCompleted: () => toast.success("下單成功"),
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (formData) => {
    createOrder({ variables: { input: formData } });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Apollo Client 緩存

GraphQL 最大的優勢之一：客户端緩存。

```javascript
// Apollo 會自動規範化緩存（根據 __typename + id）
// 同一個對象在多個查詢中共享緩存
// 一個地方更新，所有引用該對象的查詢自動更新

const client = new ApolloClient({
  uri: "/graphql",
  cache: new InMemoryCache({
    typePolicies: {
      User: {
        keyFields: ["id"], // 緩存 key
      },
      Query: {
        fields: {
          // 分頁策略
          orders: relayStylePagination(),
        },
      },
    },
  }),
});
```

## 真實體驗：好與不好

**好的地方：**

- 一次查詢獲取所有需要的數據，瀑布請求減少很多
- 類型系統 + 自動生成類型定義（配合 graphql-code-generator）
- Apollo DevTools 讓調試變得直觀

**麻煩的地方：**

- 後端學習成本高（N+1 問題需要 DataLoader 解決）
- 錯誤處理比 REST 複雜（GraphQL 永遠返回 200，錯誤在響應體裏）
- 文件上傳比 REST 麻煩
- CDN 緩存不好做（POST 請求）

**結論：** 數據關係複雜、前端團隊強、願意投入學習成本的項目值得用。簡單的 CRUD 系統用 REST 更省事。

## 小結

- GraphQL 讓前端按需獲取數據，解決了過度/不足獲取的問題
- Apollo Client 自動管理緩存，減少不必要的請求
- N+1 問題是 GraphQL 後端最常見的性能坑，用 DataLoader 解決
- 技術選型要看場景，不要為了用 GraphQL 而用 GraphQL
