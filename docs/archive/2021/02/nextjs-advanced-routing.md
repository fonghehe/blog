---
title: "Next.js 12 Middleware 中间件"
date: 2021-02-18 11:24:56
tags:
  - React
  - JavaScript
  - Next.js
readingTime: 2
description: "Next.js 12 Middleware 中间件这个话题社区讨论了很多次，但随着版本迭代，很多结论需要更新。本文基于最新版本重新梳理。"
---

Next.js 12 Middleware 中间件这个话题社区讨论了很多次，但随着版本迭代，很多结论需要更新。本文基于最新版本重新梳理。

## 入门指南

先来看基本的实现方式：

```javascript
import { Suspense } from 'react'
import { UserList } from './components/UserList'

export default async function HomePage() {
  return (
    <main className="container mx-auto p-4">
      <h1>控制台</h1>
      <Suspense fallback={<Skeleton />}>
        <UserList />
      </Suspense>
    </main>
  )
}

```

这段代码展示了基本的使用方式。实际项目中还需要考虑错误处理和边界条件。

## 源码分析

在这个基础上，我们可以进一步优化：

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

这种模式在大型项目中非常实用，能显著降低维护成本。

## 真实场景应用

实际项目中的用法会更复杂一些：

```javascript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user')
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = UserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const user = await db.user.create({ data: result.data })
  return NextResponse.json({ data: user }, { status: 201 })
}

```

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## 优化技巧

以下是一个完整的示例：

```javascript
import { useRef, useEffect, useState } from 'react'

function useIntersectionObserver(options = {}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
    }, { threshold: 0.1, ...options })
    const el = ref.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [])

  return [ref, isVisible]
}

```

注意边界条件处理，这在生产环境中至关重要。

## 小结

- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
- 团队协作中约定和文档比技术本身更重要
