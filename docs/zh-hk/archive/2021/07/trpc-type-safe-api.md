---
title: "tRPC 類型安全的 API 層：實踐方法與治理思路"
date: 2021-07-15 11:47:34
tags:
  - 前端
  - JavaScript
  - TypeScript
readingTime: 2
description: "tRPC 類型安全的 API 層這個話題社區討論了很多次，但隨着版本迭代，很多結論需要更新。本文基於最新版本重新梳理。"
wordCount: 334
---

tRPC 類型安全的 API 層這個話題社區討論了很多次，但隨着版本迭代，很多結論需要更新。本文基於最新版本重新梳理。

## 入門指南

在這個基礎上，我們可以進一步優化：

```javascript
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

## 源碼分析

實際項目中的用法會更復雜一些：

```javascript
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

## 真實場景應用

以下是一個完整的示例：

```javascript
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

## 優化技巧

關鍵在於理解核心邏輯：

```javascript
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

效能優化需要結合具體場景，不是所有情況都需要過度優化。

## 避坑指南

我們可以通過以下方式來改進：

```javascript
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

## 小結

- 代碼示例僅供參考，需根據業務場景調整
- tRPC 類型安全的 API 層不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證