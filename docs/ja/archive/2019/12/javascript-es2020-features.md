---
title: "ES2020新機能まとめ"
date: 2019-12-23 10:28:36
tags:
  - JavaScript
readingTime: 5
description: "TC39 委員会は毎年 JavaScript に新機能をもたらしています。ES2020（ES11）は提案プロセスを完了し、2020 年 6 月に正式リリースされる予定です。今回のアップデートにはいくつかの非常に実用的な機能が含まれており、特に Optional Chaining と Nullish Coalescing は日常のコードにおける防御的なチェックを大幅に削減できます。以下で一つずつ紹介します。"
wordCount: 788
---

TC39 委員会は毎年 JavaScript に新機能をもたらしています。ES2020（ES11）は提案プロセスを完了し、2020 年 6 月に正式リリースされる予定です。今回のアップデートにはいくつかの非常に実用的な機能が含まれており、特に Optional Chaining と Nullish Coalescing は、日常のコードにおける防御的なチェックを大幅に削減できます。以下で一つずつ紹介します。

## オプショナルチェーン (?.)

Optional Chaining は ES2020 の中で最も使われる機能かもしれません。深くネストされたオブジェクトのプロパティにアクセスする際、途中のプロパティが `null` または `undefined` の場合、エラーを発生させずに直接 `undefined` を返します。

```javascript
// 以前の書き方：階層ごとに判定
function getCity(user) {
  if (user && user.address && user.address.city) {
    return user.address.city
  }
  return undefined
}

// Optional Chaining を使用
function getCity(user) {
  return user?.address?.city
}

// 適用シーン1：深い階層のプロパティにアクセス
const user = {
  name: '张三',
  address: {
    city: '北京'
  }
}

console.log(user?.address?.city)      // '北京'
console.log(user?.company?.name)      // undefined（エラーにならない）
console.log(user?.['address']?.city)  // '北京'（ブラケット記法対応）

// 適用シーン2：存在しない可能性のあるメソッドを呼び出す
const api = {
  getData() { return { items: [1, 2, 3] } }
}

const data = api?.getData?.()   // { items: [1, 2, 3] }
const missing = api?.missing?.() // undefined（エラーにならない）

// 適用シーン3：配列要素にアクセス
const arr = [1, 2, 3]
console.log(arr?.[0])  // 1

const empty = null
console.log(empty?.[0]) // undefined

// 実際のプロジェクトでの応用：API レスポンス処理
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()

  // 冗長な判定が不要に
  const userName = data?.result?.user?.name ?? '不明なユーザー'
  const avatar = data?.result?.user?.profile?.avatar ?? '/default-avatar.png'

  return { userName, avatar }
}
```

## Null合体演算子 (??)

Nullish Coalescing 演算子 `??` は `||` と似ていますが、左側が `null` または `undefined` の場合にのみ右側の値を返します。この違いは `0`、`''`、`false` などの falsy な値を扱う場合に非常に重要です：

```javascript
// || の問題：すべての falsy な値を置き換えてしまう
const count = 0
console.log(count || 10)  // 10（0 が falsy として置き換えられた）

const name = ''
console.log(name || 'デフォルト名')  // 'デフォルト名'（空文字が置き換えられた）

const enabled = false
console.log(enabled || true)  // true（false が置き換えられた）

// ?? は null/undefined の場合のみ置き換える
console.log(count ?? 10)       // 0（0 が保持される）
console.log(name ?? 'デフォルト名') // ''（空文字が保持される）
console.log(enabled ?? true)   // false（false が保持される）

console.log(null ?? 'fallback')      // 'fallback'
console.log(undefined ?? 'fallback') // 'fallback'

// Optional Chaining + Nullish Coalescing の組み合わせ
const config = {
  server: {
    port: 0  // 明示的にポートを 0 に設定
  }
}

// || を使うと port:0 が誤って置き換えられる
const port1 = config?.server?.port || 3000  // 3000（誤り！）

// ?? を使うと 0 が正しく保持される
const port2 = config?.server?.port ?? 3000  // 0（正しい）

// 実際のプロジェクト：フォームのデフォルト値処理
function getFormValues(formData) {
  return {
    username: formData?.username ?? '',
    age: formData?.age ?? 0,
    enabled: formData?.enabled ?? false,
    tags: formData?.tags ?? []
  }
}
```

## BigInt

BigInt は JavaScript に新しく追加された基本データ型で、任意精度の整数を表現するために使用されます。`Number.MAX_SAFE_INTEGER`（2^53 - 1）の制限を解決します：

```javascript
// Number の精度制限
console.log(Number.MAX_SAFE_INTEGER)  // 9007199254740991
console.log(9007199254740991 + 1)     // 9007199254740992
console.log(9007199254740991 + 2)     // 9007199254740992（精度損失！）

// BigInt：数値の後ろに n を付けて作成
const bigNum = 9007199254740991n
console.log(bigNum + 1n)  // 9007199254740992n（正しい）
console.log(bigNum + 2n)  // 9007199254740993n（正しい）

// または BigInt() 関数で作成
const another = BigInt('9007199254740991999999999999')

// 基本演算
console.log(100n + 200n)    // 300n
console.log(100n * 200n)    // 20000n
console.log(100n / 30n)     // 3n（整数除算、小数切り捨て）
console.log(100n % 30n)     // 10n

// 注意：BigInt と Number は混在演算不可
// console.log(100n + 200)  // TypeError
console.log(100n + BigInt(200))  // 300n（明示的な変換が必要）

// 比較演算は混在可能
console.log(100n > 50)    // true
console.log(100n === 100) // false（型が異なる）
console.log(100n == 100)  // true（値は等しい）

// 実際の適用シーン：データベース ID、金融計算
const userId = 1589328472619638784n  // Twitter Snowflake ID
const transactionId = 2019122300000000001n
```

## Promise.allSettled

`Promise.all` はいずれかの Promise が reject されるとすぐに reject されます。`Promise.allSettled` はすべての Promise が完了するのを待ち（成功か失敗かに関わらず）、各 Promise の結果ステータスを返します：

```javascript
// Promise.all の問題：1つ失敗するとすべて失敗
const promises = [
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
]

try {
  const results = await Promise.all(promises)
  // orders リクエストが失敗した場合、ここでは users と products のデータを取得できない
} catch (error) {
  console.log(error) // 1つ失敗したことだけわかるが、どれかは不明
}

// Promise.allSettled：各結果にステータスがある
const results = await Promise.allSettled([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/orders').then(r => r.json()),
  fetch('/api/products').then(r => r.json())
])

// results の構造：
// [
//   { status: 'fulfilled', value: [...] },
//   { status: 'rejected', reason: Error('network error') },
//   { status: 'fulfilled', value: [...] }
// ]

// 成功と失敗の結果を簡単に分離
const succeeded = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason)

console.log('成功したリクエスト:', succeeded)
console.log('失敗したリクエスト:', failed)

// 実際の応用：バッチ操作、一部失敗しても他に影響しない
async function batchDelete(ids) {
  const results = await Promise.allSettled(
    ids.map(id => fetch(`/api/items/${id}`, { method: 'DELETE' }))
  )

  const deleted = []
  const errors = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deleted.push(ids[index])
    } else {
      errors.push({ id: ids[index], error: result.reason })
    }
  })

  return { deleted, errors }
}
```

## globalThis

JavaScript の実行環境によって、グローバルオブジェクトの名前は異なります。`globalThis` はグローバルオブジェクトに統一された方法でアクセスする手段を提供します：

```javascript
// 以前：環境の判定が必要
function getGlobalObject() {
  if (typeof window !== 'undefined') return window        // ブラウザ
  if (typeof global !== 'undefined') return global        // Node.js
  if (typeof self !== 'undefined') return self            // Web Worker
  throw new Error('グローバルオブジェクトを特定できません')
}

// ES2020：globalThis を直接使用
console.log(globalThis)  // ブラウザでは window、Node.js では global

// 実際の応用：環境を跨いだグローバル変数の保存
globalThis.__APP_CONFIG__ = {
  version: '1.0.0',
  env: 'production'
}

// どこからでもアクセス可能
console.log(globalThis.__APP_CONFIG__)

// polyfill（古い環境をサポートする場合）
if (typeof globalThis === 'undefined') {
  (function() {
    if (typeof window !== 'undefined') {
      window.globalThis = window
    } else if (typeof global !== 'undefined') {
      global.globalThis = global
    } else if (typeof self !== 'undefined') {
      self.globalThis = self
    }
  })()
}
```

## Dynamic Import

動的 `import()` は実行時にモジュールをオンデマンドで読み込むことを可能にし、コード分割の基礎となります：

```javascript
// 静的インポート：ファイルの先頭で、コンパイル時に決定
import { debounce } from 'lodash'

// 動的インポート：コード内で条件に応じて読み込み、実行時に決定
async function loadChart() {
  // ユーザーが「グラフを表示」をクリックしたときだけ chart.js を読み込む
  const chartModule = await import('chart.js')
  const Chart = chartModule.default

  const ctx = document.getElementById('myChart').getContext('2d')
  new Chart(ctx, { type: 'bar', data: chartData })
}

// React.lazy と組み合わせてルートレベルのコード分割を実現
import React, { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))

// 条件に応じてモジュールを読み込み
async function getParser(format) {
  switch (format) {
    case 'csv':
      return await import('./parsers/csv')
    case 'json':
      return await import('./parsers/json')
    case 'xml':
      return await import('./parsers/xml')
    default:
      throw new Error(`サポートされていない形式: ${format}`)
  }
}

// プリロード：事前にダウンロードするが実行はしない
function preloadChart() {
  // link prefetch または webpack magic comments
  import(/* webpackPrefetch: true */ 'chart.js')
}

// エラーハンドリング
async function safeImport(modulePath) {
  try {
    const module = await import(modulePath)
    return module
  } catch (error) {
    console.error(`モジュールの読み込みに失敗: ${modulePath}`, error)
    return null
  }
}
```

## 構文例のまとめ

```javascript
// ES2020 全新機能クイックレビュー

// 1. Optional Chaining
const value = obj?.prop?.nested

// 2. Nullish Coalescing
const result = maybeNull ?? 'default'

// 3. BigInt
const big = 9007199254740993n

// 4. Promise.allSettled
const outcomes = await Promise.allSettled([p1, p2, p3])

// 5. globalThis
const global = globalThis

// 6. Dynamic Import
const mod = await import('./module')

// 7. String.prototype.matchAll（これも ES2020 の機能）
const regex = /t(e)(st(\d?))/g
const str = 'test1test2'
const matches = [...str.matchAll(regex)]
// [['test1', 'e', 'st1'], ['test2', 'e', 'st2']]

// 8. import.meta（モジュールメタ情報を取得）
console.log(import.meta.url)  // 現在のモジュールの URL
```

## まとめ

- Optional Chaining (?.) は深い階層のプロパティアクセスに階層ごとの判定を不要にし、最も実用的な新機能
- Nullish Coalescing (??) は || 演算子が falsy な値を誤って置き換える問題を解決
- BigInt は大きな整数の精度損失問題を解決し、ID、金融などのシーンに適している
- Promise.allSettled はバッチ非同期操作の結果処理をより柔軟にし、「1つ失敗ですべて失敗」を解消
- globalThis は異なる環境でのグローバルオブジェクトへのアクセス方法を統一
- Dynamic import() はコード分割とオンデマンド読み込みの基盤であり、React.lazy と組み合わせることで最大の効果を発揮
- これらの機能は TypeScript 3.7+ ですでにサポートされており、先行して使用可能
