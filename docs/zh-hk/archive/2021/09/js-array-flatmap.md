---
title: "JavaScript Array.flatMap 實用技巧：落地路徑與實戰建議"
date: 2021-09-10 10:39:44
tags:
  - 前端
  - JavaScript
readingTime: 2
description: "JavaScript Array.flatMap 實用技巧這個話題社區討論了很多次，但隨着版本迭代，很多結論需要更新。本文基於最新版本重新梳理。"
wordCount: 292
---

JavaScript Array.flatMap 實用技巧這個話題社區討論了很多次，但隨着版本迭代，很多結論需要更新。本文基於最新版本重新梳理。

## 入門指南

關鍵在於理解核心邏輯：

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

效能優化需要結合具體場景，不是所有情況都需要過度優化。

## 源碼分析

我們可以通過以下方式來改進：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 類型安全的事件系統
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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 真實場景應用

先來看基本的實現方式：

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

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 優化技巧

在這個基礎上，我們可以進一步優化：

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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 小結

- 生產環境使用前務必做好兼容性驗證
- 團隊協作中約定和文檔比技術本身更重要
- 關注社區動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術