---
title: "Valtio v2 Proxy 状态管理"
date: 2024-05-14 11:13:46
tags:
  - 前端
readingTime: 2
description: "最近在团队中落地Valtio v2 Proxy 状态管理，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 298
---

最近在团队中落地Valtio v2 Proxy 状态管理，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。

## 核心概念

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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## 深度解析

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## 落地经验

关键在于理解核心逻辑：

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

性能优化需要结合具体场景，不是所有情况都需要过度优化。

## 调优策略

我们可以通过以下方式来改进：

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

这套方案已经在线上稳定运行了半年以上，经过了实际验证。

## 小结

- 关注社区动态，技术方案需要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- Valtio v2 Proxy 状态管理不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要