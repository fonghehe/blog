---
title: "前端事件驱动架构设计"
date: 2021-05-26 09:48:12
tags:
  - 前端
  - 工程化
readingTime: 2
description: "最近在团队中落地前端事件驱动架构设计，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 273
---

最近团队在落地前端事件驱动架构，积累了一些经验。整理出来供参考，希望对做类似工作的同学有帮助。

## 核心概念

关键要理解背后的核心逻辑：

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

性能优化要结合具体场景，不必处处都做。

## 深度解析

可以用下面这些方式来改进：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 类型安全的事件系统
interface EventMap {
  login: { userId: string; timestamp: number }
  logout: { userId: string }
}

class TypedEmitter<T extends Record<string, any>> {
  private handlers = new Map<keyof T, Set<Function>>()
  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }
  emit<K extends keyof T>(event: K, payload: T[K]) {
    this.handlers.get(event)?.forEach(h => h(payload))
  }
}

```

这套方案已在线上稳定运行半年多，经过真实业务验证。

## 落地经验

先看基础用法：

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

以上只是最小示例，实际项目里还要处理错误与边界条件。

## 调优策略

在此基础上还可以继续优化：

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

在大型项目里这套模式很实用，能明显降低维护成本。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- 前端事件驱动架构设计不是银弹，需结合项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证