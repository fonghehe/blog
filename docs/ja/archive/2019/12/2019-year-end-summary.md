---
title: "2019年末まとめ：Reactの深化とエンジニアリング体制のアップグレード"
date: 2019-12-30 16:17:22
tags:
  - フロントエンド
readingTime: 7
description: "2019 年是技术深度和广度都有明显成长的一年。年初定下的几个目标——React Hooks 全面落地、TypeScript 成为日常、微前端从零到一——基本都完成了。当然也有遗憾：测试覆盖率没有达到预期、Node.js BFF 的探索还停留在方案阶段。这篇总结尽量用数据说话，同时诚实地记录不足。"
---

2019 年是技术深度和广度都有明显成长的一年。年初定下的几个目标——React Hooks 全面落地、TypeScript 成为日常、微前端从零到一——基本都完成了。当然也有遗憾：测试覆盖率没有达到预期、Node.js BFF 的探索还停留在方案阶段。这篇总结尽量用数据说话，同时诚实地记录不足。

## React Hooksの全面導入

2 月 React 16.8 发布 Hooks 正式版后，我花了一个月深入学习，然后在团队推广。到年底，所有新项目都采用函数组件 + Hooks，class 组件不再出现在新代码中。

自定义 Hook 是今年最大的技术收获。团队内部沉淀了 12 个通用 Hook：

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

**代码风格演进：2018 vs 2019**

下面是一个真实的组件重写案例，展示了编码风格的变化：

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

## TypeScript習熟への道

年初对 TypeScript 的态度是"会用但不熟"，到了年底，类型体操已经成为日常。

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

**数据指标：**
- TypeScript 项目占比：从 2018 年的 20% 提升到 2019 年的 85%
- 类型覆盖率：核心模块 95%，整体 78%
- 因类型错误导致的线上 bug：相比 2018 年减少了约 60%

## マイクロフロントエンド single-spa の導入

今年最有价值的架构决策是用 single-spa 对公司的老 jQuery 系统进行了渐进式迁移。没有大规模重写，而是新功能用 Vue 开发，老功能逐步替换。

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

**成果数据：**
- 4 个微应用成功接入（2 个 Vue、1 个 React、1 个 jQuery）
- 新功能开发周期缩短约 30%（新框架开发效率更高）
- 独立部署：各微应用独立发布，互不影响
- 最大的挑战是共享状态和 CSS 隔离，最终通过 CSS Modules + 事件总线解决

## コンポーネントライブラリv2の反復

年初发布的组件库 v2 是基于 TypeScript + React Hooks 重写的：

**组件库指标：**
- 共 35 个组件（v1 是 22 个）
- TypeScript 类型覆盖率 100%
- 单元测试覆盖率 72%（目标 80%，未达成）
- 内部 npm 包周下载量从 120 次增长到 450 次
- 接入项目从 3 个增长到 8 个

## Vue 3の展望

虽然主力是 React，但对 Vue 3 的关注一直没有落下。从 Composition API RFC 阶段就开始学习，主要收获：

```javascript
// Vue 3 Composition API 对比 React Hooks 的思考
// 相似：逻辑复用、函数式风格
// 差异：
// - Vue 3 只在 setup 中调用一次，不需要考虑调用顺序
// - React Hooks 每次渲染都调用，依赖闭包和调用顺序
// - Vue 3 的响应式是自动追踪依赖，React 需要手动声明依赖数组
```

## 監視システムの構築（Sentry）

今年接入了 Sentry 做前端监控，从零到一搭建了完整的错误追踪体系：

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

**监控效果：**
- 接入前：线上问题靠用户反馈，平均发现时间 2-3 天
- 接入后：线上错误实时告警，平均发现时间 15 分钟
- 错误修复效率提升：从"找复现路径"到"直接看堆栈和上下文"
- 累计捕获并修复 47 个线上错误，其中 12 个是 P1 级别

## コードレビューと知識共有

今年认真推了 Code Review，收效显著：

**Code Review 数据：**
- 全年完成 PR Review 286 个
- 通过 Review 发现的问题中，潜在 bug 占 35%，代码规范占 40%，性能隐患占 15%，其他 10%
- 团队代码质量明显提升：月均线上 bug 从 8.2 个降到 4.5 个

**技术分享：**
- 内部技术分享 8 次（React Hooks、TypeScript、微前端、Webpack 优化等）
- 坚持写技术博客，全年发表文章 23 篇
- 写作帮助自己梳理知识体系，收益大于投入

## 反省と課題

诚实地说，有几个目标没有完成：

1. **测试覆盖率未达标**：目标 80%，实际 72%。原因是在项目进度压力下，测试被优先级挤压了。2020 年需要在 CI 中强制覆盖率门禁。
2. **Node.js BFF 停留在方案阶段**：年初计划用 Koa 搭建 BFF 层，但由于团队 Node.js 经验不足，最终只完成了技术预研。2020 年需要找一个合适的项目切入。
3. **文档不够系统**：虽然写了博客，但团队内部的规范文档还不够完善，新人上手还是靠口头传帮带。

## 2020年の計画

**技术方向：**
- Vue 3 正式版跟进：预计 Q2 发布，准备组件库的 Vue 3 版本
- React Concurrent Mode：等稳定版发布后深入学习
- 微前端扩展：从 4 个应用扩展到 8-10 个，解决共享依赖和样式隔离问题

**工程目标：**
- 测试覆盖率强制 80% 以上，CI 中设置门禁
- 前端规范文档体系化（编码规范、Git 规范、Review 规范）
- Node.js BFF 落地：选择 1-2 个项目试点

**个人成长：**
- 输出更多深度文章（从数量导向转向质量导向）
- 参加 1-2 个技术大会，做主题分享
- 阅读 5 本技术书籍

## まとめ

- React Hooks 全面落地，团队沉淀了 12 个通用 Hook，代码量减少约 20%
- TypeScript 项目占比从 20% 提升到 85%，类型错误导致的线上 bug 减少 60%
- 微前端 single-spa 成功接入 4 个应用，新功能开发周期缩短 30%
- 组件库 v2 用 TypeScript 重写，类型覆盖率 100%，接入项目从 3 个增长到 8 个
- Sentry 监控体系上线，线上问题平均发现时间从 2-3 天缩短到 15 分钟
- Code Review 坚持执行，月均线上 bug 从 8.2 个降到 4.5 个
- 测试覆盖率（72%）和 Node.js BFF 两个目标未完成，2020 年需要补上
- 2020 年重点：Vue 3 跟进、微前端扩展、测试覆盖率提升、BFF 落地
