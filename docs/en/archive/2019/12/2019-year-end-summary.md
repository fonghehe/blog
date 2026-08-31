---
title: "2019 Year-End Summary: Going Deep with React and Engineering Upgrades"
date: 2019-12-30 16:17:22
tags:
  - Frontend
readingTime: 7
description: "2019 was a year of clear growth in both the depth and breadth of my technical skills. The goals I set at the start of the year—fully rolling out React Hooks, making TypeScript part of daily work, and taking micro-frontends from zero to one—were essentially all met. There were regrets too: test coverage fell short of expectations, and our exploration of a Node.js BFF layer never moved past the planning stage. This summary tries to let the data speak, while honestly recording what fell short."
wordCount: 905
---

2019 was a year of clear growth in both the depth and breadth of my technical skills. The goals I set at the start of the year—fully rolling out React Hooks, making TypeScript part of daily work, and taking micro-frontends from zero to one—were essentially all met. There were regrets too: test coverage fell short of expectations, and our exploration of a Node.js BFF layer never moved past the planning stage. This summary tries to let the data speak, while honestly recording what fell short.

## React Hooks Fully Adopted

After React 16.8 shipped the stable Hooks API in February, I spent a month studying it in depth and then promoted it across the team. By year's end every new project used function components + Hooks, and class components no longer appeared in new code.

Custom Hooks were my biggest technical takeaway this year. The team built up a library of 12 reusable Hooks:

```typescript
// 2019 年团队自定义 Hook 库（精选）

// useRequest：统一的请求状态管理
function useRequest<T>(url: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(url, options)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(result => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [url])

  return { data, loading, error, retry: () => {/* 重新请求 */} }
}

// useIntersectionObserver：懒加载、无限滚动
function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const [node, setNode] = useState<Element | null>(null)

  const observer = useMemo(() => {
    if (typeof IntersectionObserver === 'undefined') return null
    return new IntersectionObserver(([e]) => setEntry(e), options)
  }, [options?.threshold, options?.rootMargin])

  useEffect(() => {
    if (!observer || !node) return
    observer.observe(node)
    return () => observer.disconnect()
  }, [observer, node])

  return [setNode, entry] as const
}

// useLocalStorage：持久化状态
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value
    setStoredValue(valueToStore)
    localStorage.setItem(key, JSON.stringify(valueToStore))
  }

  return [storedValue, setValue] as const
}
```

**Code Style Evolution: 2018 vs 2019**

Here is a real component-rewrite example that shows how the coding style changed:

```tsx
// ====== 2018：class 组件 + setState ======
import React, { Component } from 'react'

interface Props {
  userId: string
}

interface State {
  user: User | null
  loading: boolean
  error: string | null
}

class UserDetail extends Component<Props, State> {
  state: State = {
    user: null,
    loading: true,
    error: null
  }

  componentDidMount() {
    this.fetchUser()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.userId !== this.props.userId) {
      this.fetchUser()
    }
  }

  fetchUser = async () => {
    this.setState({ loading: true, error: null })
    try {
      const res = await fetch(`/api/users/${this.props.userId}`)
      const user = await res.json()
      this.setState({ user, loading: false })
    } catch (err) {
      this.setState({ error: err.message, loading: false })
    }
  }

  render() {
    const { user, loading, error } = this.state

    if (loading) return <div>加载中...</div>
    if (error) return <div>错误: {error}</div>
    if (!user) return null

    return (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    )
  }
}

// ====== 2019：函数组件 + Hooks ======
import React, { useState, useEffect } from 'react'

interface UserDetailProps {
  userId: string
}

function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setUser(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [userId])

  return { user, loading, error }
}

const UserDetail: React.FC<UserDetailProps> = ({ userId }) => {
  const { user, loading, error } = useUser(userId)

  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error}</div>
  if (!user) return null

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

## The Path to TypeScript Mastery

At the start of the year my attitude toward TypeScript was "I can use it but I'm not fluent." By December, type gymnastics had become part of my daily routine.

```typescript
// 2019 年掌握的 TypeScript 高级特性

// 1. 泛型约束
interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url)
  return res.json()
}

// 使用时自动推导 data 的类型
const { data: users } = await fetchData<User[]>('/api/users')
// users 的类型是 User[]

// 2. 条件类型与工具类型
type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {}

// '/user/:id/post/:postId' -> { id: string, postId: string }
type RouteParams = ExtractRouteParams<'/user/:id/post/:postId'>

// 3. 模块增强：给第三方库添加类型
declare module 'vue' {
  interface ComponentCustomProperties {
    $http: typeof axios
    $translate: (key: string) => string
  }
}

// 4. 装饰器（配合 tsconfig experimentalDecorators）
function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log(`调用 ${propertyKey}`, args)
    return original.apply(this, args)
  }
}
```

**Metrics:**
- TypeScript project share: up from 20% in 2018 to 85% in 2019
- Type coverage: 95% in core modules, 78% overall
- Production bugs caused by type errors: down about 60% versus 2018

## Micro-Frontend single-spa Adoption

The most valuable architectural decision this year was using single-spa to incrementally migrate the company's legacy jQuery system. Rather than a big rewrite, new features were built in Vue while old ones were replaced gradually.

```
架构设计：
┌─────────────────────────────────────────────┐
│               single-spa root               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ jQuery    │ │  Vue 新   │ │  React    │ │
│  │ 遗留系统  │ │  功能模块 │ │  数据看板  │ │
│  └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────────────────┘
```

**Results:**
- 4 micro-apps successfully integrated (2 Vue, 1 React, 1 jQuery)
- New-feature development cycle shortened by about 30% (the new framework is more productive)
- Independent deployment: each micro-app ships on its own, with no mutual interference
- The biggest challenge was shared state and CSS isolation, eventually solved with CSS Modules + an event bus

## Component Library v2 Iteration

The component library v2 released at the start of the year was rewritten on TypeScript + React Hooks:

**Component library metrics:**
- 35 components in total (v1 had 22)
- TypeScript type coverage 100%
- Unit-test coverage 72% (target was 80%, not met)
- Weekly downloads of the internal npm package grew from 120 to 450
- Adopting projects grew from 3 to 8

## Vue 3 Outlook

Although React is my main stack, I never stopped following Vue 3. I started learning from the Composition API RFC stage; the main takeaways:

```javascript
// Vue 3 Composition API 对比 React Hooks 的思考
// 相似：逻辑复用、函数式风格
// 差异：
// - Vue 3 只在 setup 中调用一次，不需要考虑调用顺序
// - React Hooks 每次渲染都调用，依赖闭包和调用顺序
// - Vue 3 的响应式是自动追踪依赖，React 需要手动声明依赖数组
```

## Monitoring System Setup (Sentry)

This year I integrated Sentry for frontend monitoring and built a complete error-tracking system from scratch:

```javascript
// Sentry 初始化配置
import * as Sentry from '@sentry/browser'
import { Integrations } from '@sentry/tracing'

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  integrations: [
    new Integrations.BrowserTracing(),
  ],
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,

  // 采样率：生产环境 10% 的请求做性能追踪
  tracesSampleRate: 0.1,

  // 过滤不需要上报的错误
  beforeSend(event, hint) {
    const error = hint?.originalException

    // 忽略网络错误（用户网络问题）
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return null
    }

    // 忽略浏览器扩展相关错误
    if (event.exception?.values?.[0]?.value?.includes('extension://')) {
      return null
    }

    return event
  },

  // 添加用户信息
  configureScope(scope => {
    scope.setUser({
      id: getCurrentUserId(),
      email: getCurrentUserEmail()
    })
    scope.setTag('page', window.location.pathname)
  })
})
```

**Monitoring impact:**
- Before: production issues relied on user feedback; average detection time 2–3 days
- After: real-time alerts on production errors; average detection time 15 minutes
- Faster fixes: from "hunting for a repro path" to "reading the stack and context directly"
- Cumulatively caught and fixed 47 production errors, 12 of them P1 level

## Code Review and Knowledge Sharing

This year I seriously pushed Code Review, with significant results:

**Code Review stats:**
- 286 PR reviews completed over the year
- Of issues found in review, potential bugs were 35%, code-style 40%, performance risks 15%, other 10%
- Team code quality rose noticeably: average monthly production bugs dropped from 8.2 to 4.5

**Tech sharing:**
- 8 internal tech talks (React Hooks, TypeScript, micro-frontends, Webpack optimization, etc.)
- Kept up tech blogging; published 23 articles over the year
- Writing helped me organize my knowledge system; the payoff exceeded the effort

## Shortcomings and Reflections

To be honest, a few goals went unmet:

1. **Test coverage missed the target**: goal 80%, actual 72%. The cause was project schedule pressure pushing tests down the priority list. In 2020 we need a hard coverage gate in CI.
2. **Node.js BFF stuck at the planning stage**: the plan at the start of the year was a Koa-based BFF layer, but with limited team Node.js experience we only finished a tech spike. In 2020 we need to find a suitable project to pilot it.
3. **Documentation not systematic enough**: although I blogged, the team's internal standards docs are still incomplete; onboarding new people still relies on word-of-mouth.

## 2020 Plans

**Technical direction:**
- Follow Vue 3 stable: expected in Q2; prepare the Vue 3 version of the component library
- React Concurrent Mode: study in depth once the stable release ships
- Expand micro-frontends: from 4 apps to 8–10, solving shared-dependency and style-isolation issues

**Engineering goals:**
- Enforce test coverage above 80% with a CI gate
- Systematize frontend standards docs (coding, Git, review conventions)
- Land the Node.js BFF: pilot on 1–2 projects

**Personal growth:**
- Produce more in-depth articles (shift from quantity to quality)
- Attend 1–2 tech conferences and give a talk
- Read 5 technical books

## Summary

- React Hooks fully rolled out; the team built up 12 reusable Hooks, cutting code volume by about 20%
- TypeScript project share rose from 20% to 85%, and production bugs from type errors dropped 60%
- Micro-frontend single-spa integrated 4 apps; new-feature dev cycle shortened 30%
- Component library v2 rewritten in TypeScript with 100% type coverage; adopting projects grew from 3 to 8
- Sentry monitoring went live; average production-issue detection time dropped from 2–3 days to 15 minutes
- Code Review sustained; average monthly production bugs fell from 8.2 to 4.5
- Two goals missed: test coverage (72%) and the Node.js BFF—both to be closed in 2020
- 2020 focus: follow Vue 3, expand micro-frontends, raise test coverage, and land the BFF
