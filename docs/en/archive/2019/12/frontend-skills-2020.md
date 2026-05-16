---
title: "2020 Frontend Engineer Skill Map"
date: 2019-12-26 17:41:13
tags:
  - Frontend
readingTime: 4
description: "临近年底，整理了一份 2020 年前端工程师的技能图谱。这份图谱不是面面俱到的\"技能清单\"，而是根据我自己的经验，梳理出从初级到高级前端工程师应该掌握的核心能力。我将它分为四层：基础层、框架层、工程层、架构层，每层都有具体的技术点和学习建议。"
---

临近年底，整理了一份 2020 年前端工程师的技能图谱。这份图谱不是面面俱到的"技能清单"，而是根据我自己的经验，梳理出从初级到高级前端工程师应该掌握的核心能力。我将它分为四层：基础层、框架层、工程层、架构层，每层都有具体的技术点和学习建议。

## Foundation: JavaScript / CSS / HTML

基础层是一切的根基。2020 年，基础层的要求比以前更高了——不是说会写 DOM 操作就够了，你需要深入理解语言机制。

```javascript
// JavaScript 核心：闭包、原型链、异步模型

// 1. 闭包的实际应用：防抖函数
function debounce(fn, delay) {
  let timer = null
  return function(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 2. 原型链与继承
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

// 3. Promise 原理（手写简化版）
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
/* CSS 核心：盒模型、BFC、Flexbox、Grid、响应式 */

/* BFC 的触发条件和应用场景 */
.bfc-container {
  /* 以下任一属性都会创建 BFC */
  overflow: hidden;        /* 最常用 */
  display: flow-root;      /* 最规范 */
  display: flex;
  display: grid;
  float: left;
  position: absolute;
}

/* 清除浮动的经典方案 */
.clearfix::after {
  content: '';
  display: table;
  clear: both;
}

/* Flexbox 常用布局 */
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

/* CSS 变量（Custom Properties） */
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

## Framework Layer: React / Vue

2020 年，React 和 Vue 都进入了新阶段。React Hooks 已经成熟，Vue 3 即将发布。

```typescript
// React：Hooks 模式已经是标准
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// 自定义 Hook：数据请求
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

// TypeScript + React 的类型实践
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
// Vue：准备迎接 Vue 3
// Vue 2.x + Composition API 思维模式
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
    console.log('搜索词变化:', newVal)
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

## Engineering Layer: Build / Testing / CI/CD

工程化能力是中高级前端的核心竞争力。构建工具、测试体系、CI/CD 流程缺一不可。

```javascript
// Webpack 关键配置
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
// 测试体系：单元测试 + 集成测试
// 使用 Jest + React Testing Library
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserForm from './UserForm'

describe('UserForm', () => {
  test('提交表单时调用 onSubmit', async () => {
    const onSubmit = jest.fn()
    render(<UserForm onSubmit={onSubmit} />)

    userEvent.type(screen.getByLabelText(/用户名/i), '张三')
    userEvent.type(screen.getByLabelText(/邮箱/i), 'zhangsan@example.com')
    userEvent.click(screen.getByRole('button', { name: /提交/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: '张三',
        email: 'zhangsan@example.com'
      })
    })
  })

  test('邮箱格式错误时显示提示', async () => {
    render(<UserForm onSubmit={jest.fn()} />)

    userEvent.type(screen.getByLabelText(/邮箱/i), 'invalid-email')
    userEvent.click(screen.getByRole('button', { name: /提交/i }))

    expect(await screen.findByText(/邮箱格式不正确/i)).toBeInTheDocument()
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

## Architecture Layer: Micro-Frontend / SSR / Performance

架构层是从"会写代码"到"会做系统"的跨越。2020 年微前端和 SSR 是最值得关注的方向。

```javascript
// 微前端：single-spa 基础配置
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

// 性能指标采集
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // FCP: First Contentful Paint
    // LCP: Largest Contentful Paint
    // FID: First Input Delay
    console.log(`${entry.name}: ${entry.startTime}ms`)

    // 上报到监控系统
    sendToAnalytics({
      metric: entry.name,
      value: entry.startTime,
      page: window.location.pathname
    })
  }
})

observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input'] })
```

## Learning Priority by Layer

```
初级工程师（0-2年）：
  重点：基础层 + 框架层
  - JavaScript 深入理解（闭包、原型、异步）
  - CSS 布局能力（Flexbox、Grid）
  - React 或 Vue 熟练使用
  - 基础的 Git 工作流

中级工程师（2-5年）：
  重点：工程层 + 框架层深化
  - TypeScript 熟练使用
  - 测试体系搭建
  - Webpack 构建优化
  - 性能分析与优化
  - Code Review 能力

高级工程师（5年+）：
  重点：架构层 + 团队影响力
  - 微前端架构设计
  - SSR / SSG 方案选型
  - 前端监控体系建设
  - 技术选型与方案评审
  - 团队规范与工具链建设
```

## Summary

- 基础层是根本：深入 JavaScript（闭包、原型、异步）、掌握 CSS 布局（Flexbox、Grid）
- 框架层要精通至少一个：React Hooks 模式、Vue Composition API 是 2020 年的主流方向
- 工程化是核心竞争力：构建优化、测试体系、CI/CD 是从初级到高级的分水岭
- 架构层决定天花板：微前端、SSR、性能优化需要项目经验积累
- TypeScript 在四层中都有应用，2020 年应该成为前端工程师的标配技能
- 学习要分优先级，不要试图同时掌握所有东西，根据自己的阶段选择重点
