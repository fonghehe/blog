---
title: "GraphQL Code Generator 代码生成"
date: 2021-07-12 11:13:07
tags:
  - GraphQL
  - TypeScript
readingTime: 2
description: "最近在团队中落地GraphQL Code Generator 代码生成，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 245
---

最近在团队里落地了 GraphQL Code Generator（代码生成），积累了一些经验。整理出来供参考，希望能帮到做类似工作的同学。

## 核心概念

先从基础实现看起：

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

上面是最基础的用法，实际项目里还得补上错误处理和边界情况。

## 深度解析

在此基础上还能继续优化：

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

这种写法在大型项目里很实用，能明显省下维护成本。

## 落地经验

实际项目里用起来会更复杂些：

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

这样一来，代码的可测试性和可扩展性都更好了。

## 调优策略

下面是一个完整示例：

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

生产环境里边界情况务必处理好，这点很关键。

## 小结

- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
- 团队协作中约定和文档比技术本身更重要