---
title: "Valtio: Proxy-Based State Management"
date: 2021-09-28 10:22:57
tags:
  - React
  - JavaScript

readingTime: 1
description: "Valtio Proxy 状态管理 has been discussed many times in the community, but as versions iterate, many conclusions need updating. This article revisits the topic based"
---

Valtio Proxy 状态管理 has been discussed many times in the community, but as versions iterate, many conclusions need updating. This article revisits the topic based on the latest version.

## Getting Started

Let's start with the basic implementation:

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

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Source Code Analysis

Building on this foundation, we can further optimize:

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

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Real-World Applications

实际项目中的用法会更复杂一些：

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

Through this approach, both the testability and scalability of the code are improved.

## Optimization Tips

Here is a complete example:

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

Pay attention to boundary condition handling, which is critical in production.

## Summary

- Code examples are for reference only and need to be adjusted according to your business scenario
- Valtio Proxy 状态管理不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs