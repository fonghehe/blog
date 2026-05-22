---
title: "2020 年前端工程師技能圖譜：實踐方法與治理思路"
date: 2019-12-26 17:41:13
tags:
  - 前端
readingTime: 4
description: "臨近年底，整理了一份 2020 年前端工程師的技能圖譜。這份圖譜不是面面俱到的\"技能清單\"，而是根據我自己的經驗，梳理出從初級到高級前端工程師應該掌握的核心能力。我將它分為四層：基礎層、框架層、工程層、架構層，每層都有具體的技術點和學習建議。"
wordCount: 447
---

臨近年底，整理了一份 2020 年前端工程師的技能圖譜。這份圖譜不是面面俱到的"技能清單"，而是根據我自己的經驗，梳理出從初級到高級前端工程師應該掌握的核心能力。我將它分為四層：基礎層、框架層、工程層、架構層，每層都有具體的技術點和學習建議。

## 基礎層：JavaScript / CSS / HTML

基礎層是一切的根基。2020 年，基礎層的要求比以前更高了——不是説會寫 DOM 操作就夠了，你需要深入理解語言機製。

```javascript
// JavaScript 核心：閉包、原型鏈、異步模型

// 1. 閉包的實際應用：防抖函數
function debounce(fn, delay) {
  let timer = null
  return function(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 2. 原型鏈與繼承
class EventEmitter {
  constructor() {
    this._events = {}
  }

  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = []
    }
    this._events[event].push(listener)
    return this
  }

  emit(event, ...args) {
    const listeners = this._events[event]
    if (listeners) {
      listeners.forEach(fn => fn(...args))
    }
    return this
  }

  off(event, listener) {
    if (this._events[event]) {
      this._events[event] = this._events[event].filter(fn => fn !== listener)
    }
    return this
  }
}

// 3. Promise 原理（手寫簡化版）
class MyPromise {
  constructor(executor) {
    this.state = 'pending'
    this.value = undefined
    this.onFulfilledCallbacks = []
    this.onRejectedCallbacks = []

    const resolve = (value) => {
      if (this.state === 'pending') {
        this.state = 'fulfilled'
        this.value = value
        this.onFulfilledCallbacks.forEach(fn => fn())
      }
    }

    const reject = (reason) => {
      if (this.state === 'pending') {
        this.state = 'rejected'
        this.value = reason
        this.onRejectedCallbacks.forEach(fn => fn())
      }
    }

    try {
      executor(resolve, reject)
    } catch (err) {
      reject(err)
    }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      if (this.state === 'fulfilled') {
        try {
          const result = onFulfilled(this.value)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }

      if (this.state === 'rejected') {
        try {
          const result = onRejected(this.value)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }

      if (this.state === 'pending') {
        this.onFulfilledCallbacks.push(() => {
          try {
            resolve(onFulfilled(this.value))
          } catch (err) {
            reject(err)
          }
        })
        this.onRejectedCallbacks.push(() => {
          try {
            resolve(onRejected(this.value))
          } catch (err) {
            reject(err)
          }
        })
      }
    })
  }
}
```

```css
/* CSS 核心：盒模型、BFC、Flexbox、Grid、響應式 */

/* BFC 的觸發條件和應用場景 */
.bfc-container {
  /* 以下任一屬性都會創建 BFC */
  overflow: hidden;        /* 最常用 */
  display: flow-root;      /* 最規範 */
  display: flex;
  display: grid;
  float: left;
  position: absolute;
}

/* 清除浮動的經典方案 */
.clearfix::after {
  content: '';
  display: table;
  clear: both;
}

/* Flexbox 常用佈局 */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* CSS 變量（Custom Properties） */
:root {
  --primary-color: #1890ff;
  --font-size-base: 14px;
  --border-radius: 4px;
}

.button {
  background: var(--primary-color);
  font-size: var(--font-size-base);
  border-radius: var(--border-radius);
}
```

## 框架層：React / Vue

2020 年，React 和 Vue 都進入了新階段。React Hooks 已經成熟，Vue 3 即將發佈。

```typescript
// React：Hooks 模式已經是標準
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// 自定義 Hook：數據請求
function useRequest<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    setLoading(true)
    fetch(url)
      .then(res => res.json())
      .then(result => {
        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(err => {
        if (mountedRef.current) {
          setError(err)
          setLoading(false)
        }
      })

    return () => { mountedRef.current = false }
  }, [url])

  return { data, loading, error }
}

// TypeScript + React 的類型實踐
interface User {
  id: number
  name: string
  email: string
}

interface UserCardProps {
  user: User
  onSelect: (id: number) => void
  className?: string
}

const UserCard: React.FC<UserCardProps> = ({ user, onSelect, className }) => {
  const handleClick = useCallback(() => {
    onSelect(user.id)
  }, [user.id, onSelect])

  return (
    <div className={className} onClick={handleClick}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}
```

```javascript
// Vue：準備迎接 Vue 3
// Vue 2.x + Composition API 思維模式
import { ref, computed, watch, onMounted } from 'vue'

export function useUserList() {
  const users = ref([])
  const loading = ref(false)
  const searchQuery = ref('')

  const filteredUsers = computed(() => {
    const query = searchQuery.value.toLowerCase()
    return users.value.filter(u =>
      u.name.toLowerCase().includes(query)
    )
  })

  async function fetchUsers() {
    loading.value = true
    try {
      const res = await fetch('/api/users')
      users.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  watch(searchQuery, (newVal) => {
    console.log('搜索詞變化:', newVal)
  })

  onMounted(fetchUsers)

  return {
    users,
    loading,
    searchQuery,
    filteredUsers,
    fetchUsers
  }
}
```

## 工程層：構建 / 測試 / CI/CD

工程化能力是中高級前端的核心競爭力。構建工具、測試體系、CI/CD 流程缺一不可。

```javascript
// Webpack 關鍵配置
// webpack.config.js
const config = {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 20,
        },
      },
    },
    runtimeChunk: 'single',
  },
}
```

```typescript
// 測試體系：單元測試 + 集成測試
// 使用 Jest + React Testing Library
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserForm from './UserForm'

describe('UserForm', () => {
  test('提交表單時調用 onSubmit', async () => {
    const onSubmit = jest.fn()
    render(<UserForm onSubmit={onSubmit} />)

    userEvent.type(screen.getByLabelText(/用户名/i), '張三')
    userEvent.type(screen.getByLabelText(/郵箱/i), 'zhangsan@example.com')
    userEvent.click(screen.getByRole('button', { name: /提交/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: '張三',
        email: 'zhangsan@example.com'
      })
    })
  })

  test('郵箱格式錯誤時顯示提示', async () => {
    render(<UserForm onSubmit={jest.fn()} />)

    userEvent.type(screen.getByLabelText(/郵箱/i), 'invalid-email')
    userEvent.click(screen.getByRole('button', { name: /提交/i }))

    expect(await screen.findByText(/郵箱格式不正確/i)).toBeInTheDocument()
  })
})
```

```yaml
# CI/CD：GitHub Actions 示例
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '12'
      - run: npm ci
      - run: npm run lint
      - run: npm run test -- --coverage
      - run: npm run build
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## 架構層：微前端 / SSR / 效能

架構層是從"會寫代碼"到"會做系統"的跨越。2020 年微前端和 SSR 是最值得關注的方向。

```javascript
// 微前端：single-spa 基礎配置
// root-config.js
import { registerApplication, start } from 'single-spa'

registerApplication({
  name: '@myorg/react-app',
  app: () => import('@myorg/react-app'),
  activeWhen: ['/react'],
  customProps: {
    authToken: () => localStorage.getItem('token')
  }
})

registerApplication({
  name: '@myorg/vue-app',
  app: () => import('@myorg/vue-app'),
  activeWhen: ['/vue'],
})

start()

// 性能指標採集
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // FCP: First Contentful Paint
    // LCP: Largest Contentful Paint
    // FID: First Input Delay
    console.log(`${entry.name}: ${entry.startTime}ms`)

    // 上報到監控系統
    sendToAnalytics({
      metric: entry.name,
      value: entry.startTime,
      page: window.location.pathname
    })
  }
})

observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input'] })
```

## 各層級學習優先級

```
初級工程師（0-2年）：
  重點：基礎層 + 框架層
  - JavaScript 深入理解（閉包、原型、異步）
  - CSS 佈局能力（Flexbox、Grid）
  - React 或 Vue 熟練使用
  - 基礎的 Git 工作流

中級工程師（2-5年）：
  重點：工程層 + 框架層深化
  - TypeScript 熟練使用
  - 測試體系搭建
  - Webpack 構建優化
  - 性能分析與優化
  - Code Review 能力

高級工程師（5年+）：
  重點：架構層 + 團隊影響力
  - 微前端架構設計
  - SSR / SSG 方案選型
  - 前端監控體系建設
  - 技術選型與方案評審
  - 團隊規範與工具鏈建設
```

## 小結

- 基礎層是根本：深入 JavaScript（閉包、原型、異步）、掌握 CSS 佈局（Flexbox、Grid）
- 框架層要精通至少一個：React Hooks 模式、Vue Composition API 是 2020 年的主流方向
- 工程化是核心競爭力：構建優化、測試體系、CI/CD 是從初級到高級的分水嶺
- 架構層決定天花板：微前端、SSR、效能優化需要項目經驗積累
- TypeScript 在四層中都有應用，2020 年應該成為前端工程師的標配技能
- 學習要分優先級，不要試圖同時掌握所有東西，根據自己的階段選擇重點
