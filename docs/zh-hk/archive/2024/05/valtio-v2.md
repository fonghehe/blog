---
title: "Valtio v2 Proxy 狀態管理"
date: 2024-05-14 11:13:46
tags:
  - 前端
readingTime: 2
description: "最近在團隊中落地Valtio v2 Proxy 狀態管理，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
wordCount: 298
---

最近在團隊中落地Valtio v2 Proxy 狀態管理，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

實際項目中的用法會更復雜一些：

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

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 深度解析

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

## 落地經驗

關鍵在於理解核心邏輯：

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

性能優化需要結合具體場景，不是所有情況都需要過度優化。

## 調優策略

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 小結

- 關注社區動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 代碼示例僅供參考，需根據業務場景調整
- Valtio v2 Proxy 狀態管理不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要