---
title: "2019 年終總結：React 深入與工程體系升級"
date: 2019-12-30 16:17:22
tags:
  - 前端
readingTime: 7
description: "2019 年是技術深度和廣度都有明顯成長的一年。年初定下的幾個目標——React Hooks 全面落地、TypeScript 成為日常、微前端從零到一——基本都完成了。當然也有遺憾：測試覆蓋率沒有達到預期、Node.js BFF 的探索還停留在方案階段。這篇總結儘量用資料說話，同時誠實地記錄不足。"
wordCount: 1420
---

2019 年是技術深度和廣度都有明顯成長的一年。年初定下的幾個目標——React Hooks 全面落地、TypeScript 成為日常、微前端從零到一——基本都完成了。當然也有遺憾：測試覆蓋率沒有達到預期、Node.js BFF 的探索還停留在方案階段。這篇總結儘量用資料說話，同時誠實地記錄不足。

## React Hooks 全面落地

2 月 React 16.8 釋出 Hooks 正式版後，我花了一個月深入學習，然後在團隊推廣。到年底，所有新專案都採用函式元件 + Hooks，class 元件不再出現在新程式碼中。

自定義 Hook 是今年最大的技術收穫。團隊內部沉澱了 12 個通用 Hook：

```typescript
// 2019 年團隊自定義 Hook 庫（精選）

// useRequest：統一的請求狀態管理
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

  return { data, loading, error, retry: () => {/* 重新請求 */} }
}

// useIntersectionObserver：懶載入、無限滾動
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

// useLocalStorage：持久化狀態
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

**程式碼風格演進：2018 vs 2019**

下面是一個真實的元件重寫案例，展示了編碼風格的變化：

```tsx
// ====== 2018：class 元件 + setState ======
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

    if (loading) return <div>載入中...</div>
    if (error) return <div>錯誤: {error}</div>
    if (!user) return null

    return (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    )
  }
}

// ====== 2019：函式元件 + Hooks ======
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

  if (loading) return <div>載入中...</div>
  if (error) return <div>錯誤: {error}</div>
  if (!user) return null

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

## TypeScript 精通之路

年初對 TypeScript 的態度是"會用但不熟"，到了年底，型別體操已經成為日常。

```typescript
// 2019 年掌握的 TypeScript 高階特性

// 1. 泛型約束
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

// 使用時自動推導 data 的型別
const { data: users } = await fetchData<User[]>('/api/users')
// users 的型別是 User[]

// 2. 條件型別與工具型別
type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {}

// '/user/:id/post/:postId' -> { id: string, postId: string }
type RouteParams = ExtractRouteParams<'/user/:id/post/:postId'>

// 3. 模組增強：給第三方庫新增型別
declare module 'vue' {
  interface ComponentCustomProperties {
    $http: typeof axios
    $translate: (key: string) => string
  }
}

// 4. 裝飾器（配合 tsconfig experimentalDecorators）
function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log(`呼叫 ${propertyKey}`, args)
    return original.apply(this, args)
  }
}
```

**資料指標：**
- TypeScript 專案佔比：從 2018 年的 20% 提升到 2019 年的 85%
- 型別覆蓋率：核心模組 95%，整體 78%
- 因型別錯誤導致的線上 bug：相比 2018 年減少了約 60%

## 微前端 single-spa 落地

今年最有價值的架構決策是用 single-spa 對公司的老 jQuery 系統進行了漸進式遷移。沒有大規模重寫，而是新功能用 Vue 開發，老功能逐步替換。

```
架構設計：
┌─────────────────────────────────────────────┐
│               single-spa root               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ jQuery    │ │  Vue 新   │ │  React    │ │
│  │ 遺留系統  │ │  功能模組 │ │  資料看板  │ │
│  └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────────────────┘
```

**成果資料：**
- 4 個微應用成功接入（2 個 Vue、1 個 React、1 個 jQuery）
- 新功能開發週期縮短約 30%（新框架開發效率更高）
- 獨立部署：各微應用獨立釋出，互不影響
- 最大的挑戰是共享狀態和 CSS 隔離，最終通過 CSS Modules + 事件匯流排解決

## 元件庫 v2 迭代

年初發布的元件庫 v2 是基於 TypeScript + React Hooks 重寫的：

**元件庫指標：**
- 共 35 個元件（v1 是 22 個）
- TypeScript 型別覆蓋率 100%
- 單元測試覆蓋率 72%（目標 80%，未達成）
- 內部 npm 包周下載量從 120 次增長到 450 次
- 接入專案從 3 個增長到 8 個

## Vue 3 前瞻

雖然主力是 React，但對 Vue 3 的關注一直沒有落下。從 Composition API RFC 階段就開始學習，主要收穫：

```javascript
// Vue 3 Composition API 對比 React Hooks 的思考
// 相似：邏輯複用、函式式風格
// 差異：
// - Vue 3 隻在 setup 中呼叫一次，不需要考慮呼叫順序
// - React Hooks 每次渲染都呼叫，依賴閉包和呼叫順序
// - Vue 3 的響應式是自動追蹤依賴，React 需要手動宣告依賴陣列
```

## 監控體系搭建（Sentry）

今年接入了 Sentry 做前端監控，從零到一搭建了完整的錯誤追蹤體系：

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

  // 取樣率：生產環境 10% 的請求做效能追蹤
  tracesSampleRate: 0.1,

  // 過濾不需要上報的錯誤
  beforeSend(event, hint) {
    const error = hint?.originalException

    // 忽略網路錯誤（使用者網路問題）
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return null
    }

    // 忽略瀏覽器擴充套件相關錯誤
    if (event.exception?.values?.[0]?.value?.includes('extension://')) {
      return null
    }

    return event
  },

  // 新增使用者資訊
  configureScope(scope => {
    scope.setUser({
      id: getCurrentUserId(),
      email: getCurrentUserEmail()
    })
    scope.setTag('page', window.location.pathname)
  })
})
```

**監控效果：**
- 接入前：線上問題靠使用者反饋，平均發現時間 2-3 天
- 接入後：線上錯誤即時告警，平均發現時間 15 分鐘
- 錯誤修復效率提升：從"找復現路徑"到"直接看堆疊和上下文"
- 累計捕獲並修復 47 個線上錯誤，其中 12 個是 P1 級別

## Code Review 與技術分享

今年認真推了 Code Review，收效顯著：

**Code Review 資料：**
- 全年完成 PR Review 286 個
- 通過 Review 發現的問題中，潛在 bug 佔 35%，程式碼規範佔 40%，效能隱患佔 15%，其他 10%
- 團隊程式碼質量明顯提升：月均線上 bug 從 8.2 個降到 4.5 個

**技術分享：**
- 內部技術分享 8 次（React Hooks、TypeScript、微前端、Webpack 最佳化等）
- 堅持寫技術部落格，全年發表文章 23 篇
- 寫作幫助自己梳理知識體系，收益大於投入

## 不足與反思

誠實地說，有幾個目標沒有完成：

1. **測試覆蓋率未達標**：目標 80%，實際 72%。原因是在專案進度壓力下，測試被優先順序擠壓了。2020 年需要在 CI 中強製覆蓋率門禁。
2. **Node.js BFF 停留在方案階段**：年初計劃用 Koa 搭建 BFF 層，但由於團隊 Node.js 經驗不足，最終隻完成了技術預研。2020 年需要找一個合適的專案切入。
3. **文件不夠系統**：雖然寫了部落格，但團隊內部的規範文件還不夠完善，新人上手還是靠口頭傳幫帶。

## 2020 年規劃

**技術方向：**
- Vue 3 正式版跟進：預計 Q2 釋出，準備元件庫的 Vue 3 版本
- React Concurrent Mode：等穩定版釋出後深入學習
- 微前端擴充套件：從 4 個應用擴充套件到 8-10 個，解決共享依賴和樣式隔離問題

**工程目標：**
- 測試覆蓋率強製 80% 以上，CI 中設定門禁
- 前端規範文件體系化（編碼規範、Git 規範、Review 規範）
- Node.js BFF 落地：選擇 1-2 個專案試點

**個人成長：**
- 輸出更多深度文章（從數量導向轉向質量導向）
- 參加 1-2 個技術大會，做主題分享
- 閱讀 5 本技術書籍

## 小結

- React Hooks 全面落地，團隊沉澱了 12 個通用 Hook，程式碼量減少約 20%
- TypeScript 專案佔比從 20% 提升到 85%，型別錯誤導致的線上 bug 減少 60%
- 微前端 single-spa 成功接入 4 個應用，新功能開發週期縮短 30%
- 元件庫 v2 用 TypeScript 重寫，型別覆蓋率 100%，接入專案從 3 個增長到 8 個
- Sentry 監控體系上線，線上問題平均發現時間從 2-3 天縮短到 15 分鐘
- Code Review 堅持執行，月均線上 bug 從 8.2 個降到 4.5 個
- 測試覆蓋率（72%）和 Node.js BFF 兩個目標未完成，2020 年需要補上
- 2020 年重點：Vue 3 跟進、微前端擴充套件、測試覆蓋率提升、BFF 落地
