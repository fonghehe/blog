---
title: "Zustand v4 新版本特性：落地路徑與實戰建議"
date: 2022-05-02 09:31:10
tags:
  - 前端
readingTime: 2
description: "Zustand v4 新版本特性在前端開發中的應用越來越廣泛。本文從實際項目出發，深入分析其核心原理和最佳實踐。"
wordCount: 321
---

Zustand v4 新版本特性在前端開發中的應用越來越廣泛。本文從實際項目出發，深入分析其核心原理和最佳實踐。

## 基礎用法

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

## 進階用法

實際項目中的用法會更復雜一些：

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

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 實戰案例

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

## 效能優化

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

效能優化需要結合具體場景，不是所有情況都需要過度優化。

## 常見陷阱

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

## 小結

- 團隊協作中約定和文檔比技術本身更重要
- 關注社區動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 代碼示例僅供參考，需根據業務場景調整