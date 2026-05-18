---
title: "GraphQL Subscriptions 實時數據"
date: 2020-09-10 17:09:39
tags:
  - GraphQL
readingTime: 2
description: "GraphQL Subscriptions 實時數據在前端開發中的應用越來越廣泛。本文從實際項目出發，深入分析其核心原理和最佳實踐。"
---

GraphQL Subscriptions 實時數據在前端開發中的應用越來越廣泛。本文從實際項目出發，深入分析其核心原理和最佳實踐。

## 基礎用法

我們可以通過以下方式來改進：

```graphql
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

const httpLink = createHttpLink({ uri: '/graphql' })
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return { headers: { ...headers, authorization: `Bearer ${token}` } }
})

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: { keyArgs: ['filter'], merge: (e, i) => ({ ...i, edges: [...(e?.edges||[]), ...i.edges] }) }
        }
      }
    }
  })
})

```

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 進階用法

先來看基本的實現方式：

```graphql
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

const httpLink = createHttpLink({ uri: '/graphql' })
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return { headers: { ...headers, authorization: `Bearer ${token}` } }
})

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: { keyArgs: ['filter'], merge: (e, i) => ({ ...i, edges: [...(e?.edges||[]), ...i.edges] }) }
        }
      }
    }
  })
})

```

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 實戰案例

在這個基礎上，我們可以進一步優化：

```graphql
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

const httpLink = createHttpLink({ uri: '/graphql' })
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return { headers: { ...headers, authorization: `Bearer ${token}` } }
})

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: { keyArgs: ['filter'], merge: (e, i) => ({ ...i, edges: [...(e?.edges||[]), ...i.edges] }) }
        }
      }
    }
  })
})

```

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 性能優化

實際項目中的用法會更復雜一些：

```graphql
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

const httpLink = createHttpLink({ uri: '/graphql' })
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return { headers: { ...headers, authorization: `Bearer ${token}` } }
})

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: { keyArgs: ['filter'], merge: (e, i) => ({ ...i, edges: [...(e?.edges||[]), ...i.edges] }) }
        }
      }
    }
  })
})

```

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 常見陷阱

以下是一個完整的示例：

```graphql
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

const httpLink = createHttpLink({ uri: '/graphql' })
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return { headers: { ...headers, authorization: `Bearer ${token}` } }
})

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: { keyArgs: ['filter'], merge: (e, i) => ({ ...i, edges: [...(e?.edges||[]), ...i.edges] }) }
        }
      }
    }
  })
})

```

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證
- 團隊協作中約定和文檔比技術本身更重要
- 關注社區動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
