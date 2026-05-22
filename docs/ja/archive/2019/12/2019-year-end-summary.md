---
title: "2019年末まとめ：Reactの深化とエンジニアリング体制のアップグレード"
date: 2019-12-30 16:17:22
tags:
  - フロントエンド
readingTime: 10
description: "2019 年は技術の深さと幅の両面で著しい成長を遂げた一年でした。年初に掲げたいくつかの目標——React Hooks の全面導入、TypeScript の日常化、マイクロフロントエンドのゼロからの構築——はほぼ達成できました。もちろん残念な点もあります：テストカバレッジが期待に届かなかったこと、Node.js BFF の探求がまだ計画段階にとどまっていることです。この総括ではできるだけデータに基づいて語り、同時に不足点を正直に記録します。"
wordCount: 2194
---

2019 年は技術の深さと幅の両方で著しい成長を遂げた一年でした。年初に掲げたいくつかの目標——React Hooks の全面導入、TypeScript の日常化、マイクロフロントエンドのゼロからの構築——はほぼ達成できました。もちろん残念な点もあります：テストカバレッジが期待に届かなかったこと、Node.js BFF の探求がまだ計画段階にとどまっていることです。この総括ではできるだけデータに基づいて語り、同時に不足点を正直に記録します。

## React Hooksの全面導入

2 月に React 16.8 で Hooks の正式版がリリースされた後、1ヶ月かけて深く学び、チームに展開しました。年末までに、すべての新規プロジェクトで関数コンポーネント + Hooks を採用し、class コンポーネントは新しいコードには登場しなくなりました。

カスタム Hook は今年最大の技術的収穫でした。チーム内で 12 個の汎用 Hook が蓄積されました：

```typescript
// 2019 年チームカスタム Hook ライブラリ（厳選）

// useRequest：統一されたリクエスト状態管理
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

  return { data, loading, error, retry: () => {/* 再リクエスト */} }
}

// useIntersectionObserver：遅延読み込み、無限スクロール
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

// useLocalStorage：状態の永続化
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

**コードスタイルの進化：2018 vs 2019**

実際のコンポーネント書き換え事例で、コーディングスタイルの変化を示します：

```tsx
// ====== 2018：class コンポーネント + setState ======
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

    if (loading) return <div>読み込み中...</div>
    if (error) return <div>エラー: {error}</div>
    if (!user) return null

    return (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    )
  }
}

// ====== 2019：関数コンポーネント + Hooks ======
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

  if (loading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error}</div>
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

年初は TypeScript に対して「使えるが詳しくない」という態度でしたが、年末には型体操が日常になっていました。

```typescript
// 2019 年に習得した TypeScript の高度な機能

// 1. ジェネリック制約
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

// 使用時に data の型が自動推論される
const { data: users } = await fetchData<User[]>('/api/users')
// users の型は User[]

// 2. 条件型とユーティリティ型
type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {}

// '/user/:id/post/:postId' -> { id: string, postId: string }
type RouteParams = ExtractRouteParams<'/user/:id/post/:postId'>

// 3. モジュール拡張：サードパーティライブラリに型を追加
declare module 'vue' {
  interface ComponentCustomProperties {
    $http: typeof axios
    $translate: (key: string) => string
  }
}

// 4. デコレータ（tsconfig の experimentalDecorators と併用）
function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log(`${propertyKey} を呼び出し`, args)
    return original.apply(this, args)
  }
}
```

**データ指標：**
- TypeScript プロジェクト比率：2018 年の 20% から 2019 年には 85% に向上
- 型カバレッジ：コアモジュール 95%、全体 78%
- 型エラーによる本番バグ：2018 年比で約 60% 削減

## マイクロフロントエンド single-spa の導入

今年最も価値のあるアーキテクチャ上の決定は、single-spa を使って会社の古い jQuery システムを段階的に移行したことです。大規模な書き換えは行わず、新機能は Vue で開発し、古い機能を徐々に置き換えていきました。

```
アーキテクチャ設計：
┌─────────────────────────────────────────────┐
│               single-spa root               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ jQuery    │ │  Vue 新   │ │  React    │ │
│  │ レガシー  │ │  機能     │ │  ダッシュ  │ │
│  │ システム  │ │  モジュール│ │  ボード   │ │
│  └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────────────────┘
```

**成果データ：**
- 4 つのマイクロアプリケーションの接続に成功（2 つが Vue、1 つが React、1 つが jQuery）
- 新機能の開発サイクルが約 30% 短縮（新しいフレームワークの開発効率が向上）
- 独立デプロイ：各マイクロアプリケーションは独立してリリースされ、互いに影響しない
- 最大の課題は共有状態と CSS の分離でしたが、最終的に CSS Modules + イベントバスで解決

## コンポーネントライブラリv2の反復

年初にリリースしたコンポーネントライブラリ v2 は TypeScript + React Hooks で書き直されました：

**コンポーネントライブラリ指標：**
- 合計 35 個のコンポーネント（v1 は 22 個）
- TypeScript 型カバレッジ 100%
- 単体テストカバレッジ 72%（目標 80%、未達成）
- 内部 npm パッケージの週間ダウンロード数が 120 回から 450 回に増加
- 導入プロジェクトが 3 つから 8 つに増加

## Vue 3の展望

メインは React ですが、Vue 3 への関心も常に持ち続けていました。Composition API の RFC 段階から学習を始め、主な収穫は以下の通りです：

```javascript
// Vue 3 Composition API と React Hooks の比較考察
// 類似点：ロジックの再利用、関数型スタイル
// 相違点：
// - Vue 3 は setup 内で一度だけ呼び出され、呼び出し順序を気にする必要がない
// - React Hooks はレンダリングのたびに呼び出され、クロージャと呼び出し順序に依存
// - Vue 3 のリアクティブは依存関係を自動追跡、React は依存配列を手動宣言が必要
```

## 監視システムの構築（Sentry）

今年は Sentry を導入してフロントエンド監視を行い、ゼロから完全なエラートラッキングシステムを構築しました：

```javascript
// Sentry 初期化設定
import * as Sentry from '@sentry/browser'
import { Integrations } from '@sentry/tracing'

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  integrations: [
    new Integrations.BrowserTracing(),
  ],
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,

  // サンプリングレート：本番環境では 10% のリクエストをパフォーマンストレース
  tracesSampleRate: 0.1,

  // 報告不要なエラーをフィルタリング
  beforeSend(event, hint) {
    const error = hint?.originalException

    // ネットワークエラーを無視（ユーザーのネットワーク問題）
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return null
    }

    // ブラウザ拡張機能関連のエラーを無視
    if (event.exception?.values?.[0]?.value?.includes('extension://')) {
      return null
    }

    return event
  },

  // ユーザー情報を追加
  configureScope(scope => {
    scope.setUser({
      id: getCurrentUserId(),
      email: getCurrentUserEmail()
    })
    scope.setTag('page', window.location.pathname)
  })
})
```

**監視効果：**
- 導入前：本番の問題はユーザーフィードバックに依存、平均発見時間 2〜3 日
- 導入後：本番エラーはリアルタイムで警告、平均発見時間 15 分
- エラー修正効率の向上：「再現手順を探す」から「スタックとコンテキストを直接確認」へ
- 累計で 47 個の本番エラーを捕捉・修正、うち 12 個は P1 レベル

## コードレビューと知識共有

今年は Code Review を本格的に推進し、顕著な効果がありました：

**Code Review データ：**
- 年間で PR Review を 286 件完了
- Review で発見された問題のうち、潜在的なバグ 35%、コード規範 40%、パフォーマンスリスク 15%、その他 10%
- チームのコード品質が明らかに向上：月間平均本番バグが 8.2 個から 4.5 個に減少

**技術共有：**
- 内部技術共有会を 8 回実施（React Hooks、TypeScript、マイクロフロントエンド、Webpack 最適化など）
- 技術ブログを継続的に執筆、年間 23 本の記事を公開
- 執筆は自分の知識体系を整理するのに役立ち、投資以上の収益があった

## 反省と課題

正直に言うと、いくつかの目標は達成できませんでした：

1. **テストカバレッジ未達**：目標 80%、実績 72%。原因はプロジェクトの進捗プレッシャーの下で、テストの優先順位が低くなったことです。2020 年は CI でカバレッジゲートを強制する必要があります。
2. **Node.js BFF が計画段階で停滞**：年初は Koa で BFF 層を構築する計画でしたが、チームの Node.js 経験不足により、技術調査のみで終わりました。2020 年は適切なプロジェクトを見つけて着手する必要があります。
3. **ドキュメントが体系化されていない**：ブログは書いていますが、チーム内部の規範ドキュメントはまだ不十分で、新人のオンボーディングは口頭での引き継ぎに頼っています。

## 2020年の計画

**技術的方向性：**
- Vue 3 正式版のフォロー：Q2 リリース予定、コンポーネントライブラリの Vue 3 版を準備
- React Concurrent Mode：安定版リリース後に深く学ぶ
- マイクロフロントエンドの拡張：4 つから 8〜10 のアプリケーションに拡大、依存関係の共有とスタイルの分離問題を解決

**エンジニアリング目標：**
- テストカバレッジを強制的に 80% 以上に、CI でゲートを設定
- フロントエンド規範ドキュメントの体系化（コーディング規範、Git 規範、Review 規範）
- Node.js BFF の導入：1〜2 つのプロジェクトを選んで試験運用

**個人の成長：**
- より深みのある記事を執筆（量指向から質指向へ）
- 1〜2 つの技術カンファレンスに参加し、テーマ発表を行う
- 技術書を 5 冊読む

## まとめ

- React Hooks を全面導入、チームに 12 個の汎用 Hook が蓄積され、コード量が約 20% 削減
- TypeScript プロジェクト比率が 20% から 85% に向上、型エラーによる本番バグが 60% 削減
- マイクロフロントエンド single-spa が 4 つのアプリケーションに導入成功、新機能の開発サイクルが 30% 短縮
- コンポーネントライブラリ v2 を TypeScript で書き換え、型カバレッジ 100%、導入プロジェクトが 3 つから 8 つに増加
- Sentry 監視システムを稼働、本番問題の平均発見時間が 2〜3 日から 15 分に短縮
- Code Review を継続的に実施、月間平均本番バグが 8.2 個から 4.5 個に減少
- テストカバレッジ（72%）と Node.js BFF の 2 つの目標は未達成、2020 年に取り組む必要がある
- 2020 年の重点：Vue 3 フォロー、マイクロフロントエンド拡張、テストカバレッジ向上、BFF 導入
