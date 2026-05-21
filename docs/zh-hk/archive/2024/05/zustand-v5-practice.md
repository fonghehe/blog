---
title: "Zustand v5 實戰應用"
date: 2024-05-10 16:06:27
tags:
  - 前端
readingTime: 2
description: "最近在團隊中落地Zustand v5 實戰應用，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
wordCount: 315
---

最近在團隊中落地Zustand v5 實戰應用，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

以下是一個完整的示例：

```javascript
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

const useStore = create(
  devtools(persist(
    (set, get) => ({
      user: null,
      theme: 'light',
      notifications: [],
      setUser: (user) => set({ user }),
      toggleTheme: () => set(s => ({
        theme: s.theme === 'light' ? 'dark' : 'light'
      })),
      unreadCount: () => get().notifications.filter(n => !n.read).length
    }),
    { name: 'app-store' }
  ))
)

```

注意邊界條件處理，這在生產環境中至關重要。

## 深度解析

關鍵在於理解核心邏輯：

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

性能優化需要結合具體場景，不是所有情況都需要過度優化。

## 落地經驗

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 調優策略

先來看基本的實現方式：

```javascript
import { useState, useEffect, useCallback } from 'react'

function DataList({ endpoint, pageSize = 20 }) {
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?page=${page}&size=${pageSize}`)
      setData(await res.json())
    } finally { setLoading(false) }
  }, [endpoint, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  return <div>{loading ? <Spinner /> : <List items={data} />}</div>
}

```

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 注意事項

在這個基礎上，我們可以進一步優化：

```javascript
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

const useStore = create(
  devtools(persist(
    (set, get) => ({
      user: null,
      theme: 'light',
      notifications: [],
      setUser: (user) => set({ user }),
      toggleTheme: () => set(s => ({
        theme: s.theme === 'light' ? 'dark' : 'light'
      })),
      unreadCount: () => get().notifications.filter(n => !n.read).length
    }),
    { name: 'app-store' }
  ))
)

```

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 小結

- 不要為了用新技術而用新技術
- 代碼示例僅供參考，需根據業務場景調整
- Zustand v5 實戰應用不是銀彈，需要根據項目規模和技術棧選擇