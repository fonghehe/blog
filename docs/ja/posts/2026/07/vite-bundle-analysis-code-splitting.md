---
title: "Vite ビルド成果物の分析とコード分割戦略：Bundle から実行時まで"
date: 2026-07-12 11:15:41
tags:
  - Vite
  - 工程化
readingTime: 12
description: "Vite の本番ビルドは Rollup/Rolldown に基づくパッケージングであり、コード分割戦略が初回レンダリング性能に直結する。本記事では manualChunks 設定、動的 import、modulepreload プリロード、Tree Shaking の落とし穴、CSS 分割を詳解し、500KB の初回 bundle を 80KB に最適化する完全なプロセスを示す。"
wordCount: 2429
---

Vite の開発体験はすでにフロントエンドツールチェインのベンチマークとなっているが、本番ビルドの性能最適化は依然として多くのチームの盲点である。dev モードでのオンデマンド読み込みの ESM モジュールは、本番環境では静的リソースにパッケージされる。この過程でのコード分割戦略、プリロードメカニズム、Tree Shaking の効果が、ユーザーの初回レンダリング体験を直接決定する。

## Vite 本番ビルドのパッケージングメカニズム

Vite の本番ビルドは 6.x 以前では Rollup に基づき、6.x から Rolldown（Rust 実装の Rollup 互換代替）を導入した。両者の設定インターフェースはほぼ同一だが、Rolldown は大型プロジェクトのビルド速度で顕著な向上をもたらす。

```javascript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // エントリファイルの命名
        entryFileNames: 'assets/[name].[hash].js',
        // コード分割後の chunk 命名
        chunkFileNames: 'assets/[name].[hash].js',
        // 静的リソースの命名
        assetFileNames: 'assets/[name].[hash].[ext]',
        // 高度なコード分割設定
        manualChunks(id) {
          // ロジックは後述
        },
      },
    },
  },
})
```

ビルドフローのコアステップ：

1. **モジュール解決**：エントリから開始し、import/require 依存を再帰的に解決
2. **Tree Shaking**：未使用の export をマークし、生成段階で削除
3. **コード分割**：動的 import と manualChunks 設定に基づき chunk を分割
4. **Chunk 統合**：分割条件を満たすモジュールを同じ chunk に統合
5. **コード生成**：最終的な JS/CSS ファイルを出力し、modulepreload を注入
6. **圧縮**：esbuild または terser で圧縮

## manualChunks 設定戦略

`manualChunks` はコード分割を制御する最も直接的な設定である。デフォルトでは、Vite は動的 import のモジュールのみを独立 chunk に分割し、残りはすべてエントリ chunk に押し込む。中大型プロジェクトでは、これはエントリ chunk の膨張を引き起こす。

### 基本戦略：依存タイプ別の分割

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // node_modules 内の依存
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'react-vendor'
            }
            if (id.includes('vue')) {
              return 'vue-vendor'
            }
            if (id.includes('@ant-design') || id.includes('antd')) {
              return 'ui-vendor'
            }
            // その他のサードパーティ依存
            return 'vendor'
          }
        },
      },
    },
  },
})
```

### 応用戦略：ルートと機能別の分割

```javascript
manualChunks(id) {
  // React コアライブラリ
  if (id.includes('node_modules/react/') ||
      id.includes('node_modules/react-dom/') ||
      id.includes('node_modules/scheduler/')) {
    return 'react-core'
  }

  // ルーターライブラリ
  if (id.includes('node_modules/react-router') ||
      id.includes('node_modules/@remix-run')) {
    return 'router'
  }

  // 状態管理
  if (id.includes('node_modules/zustand') ||
      id.includes('node_modules/jotai') ||
      id.includes('node_modules/@reduxjs')) {
    return 'state'
  }

  // UI コンポーネントライブラリ
  if (id.includes('node_modules/@radix-ui') ||
      id.includes('node_modules/framer-motion')) {
    return 'ui-lib'
  }

  // ユーティリティライブラリ
  if (id.includes('node_modules/lodash') ||
      id.includes('node_modules/dayjs') ||
      id.includes('node_modules/clsx')) {
    return 'utils'
  }

  // チャートライブラリ（サイズ大、オンデマンド読み込み）
  if (id.includes('node_modules/recharts') ||
      id.includes('node_modules/d3-') ||
      id.includes('node_modules/chart.js')) {
    return 'charts'
  }

  // エディタ（サイズ大、オンデマンド読み込み）
  if (id.includes('node_modules/monaco-editor') ||
      id.includes('node_modules/@codemirror')) {
    return 'editor'
  }
}
```

### 過剰分割の回避

```javascript
// ❌ 過剰分割：各 npm パッケージが一つの chunk
manualChunks(id) {
  if (id.includes('node_modules')) {
    const match = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
    return match ? match[1] : 'vendor'
  }
}
```

過剰分割は大量の小 chunk を生み出し、HTTP リクエスト数を増加させる。HTTP/2 環境下ではリクエストオーバーヘッドは低下したが、ブラウザの並列解析とコンパイルのオーバーヘッドは依然として無視できない。経験則として：各 chunk は 5KB 未満にせず、vendor chunk は 5 個を超えないこと。

## 動的 import とルートレベルのコード分割

ルートレベルのコード分割は初回 bundle を削減する最も効果的な手段である。React Router を例に：

```typescript
// ❌ 静的インポート：全ルートが初回 bundle にパッケージ
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

const routes = [
  { path: '/', element: <Home /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/settings', element: <Settings /> },
  { path: '/profile', element: <Profile /> },
]

// ✅ 動的インポート：ルート別に分割
import { lazy, Suspense } from 'react'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))

const routes = [
  {
    path: '/',
    element: (
      <Suspense fallback={<Loading />}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    ),
  },
  // ...
]
```

Vue Router のルートレベル分割はよりシンプルである：

```typescript
const routes = [
  {
    path: '/',
    component: () => import('./pages/Home.vue'),
  },
  {
    path: '/dashboard',
    component: () => import('./pages/Dashboard.vue'),
  },
]
```

### コンポーネントレベルのコード分割

ルートレベルに加え、重量級コンポーネントもオンデマンド読み込みすべきである：

```typescript
// チャートコンポーネント：必要時にのみ読み込み
const HeavyChart = lazy(() => import('./components/HeavyChart'))

function Dashboard({ showChart }) {
  return (
    <div>
      <Summary />
      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <HeavyChart data={chartData} />
        </Suspense>
      )}
    </div>
  )
}

// エディタコンポーネント：遅延読み込み
const CodeEditor = lazy(() => import('./components/CodeEditor'))

function CodeBlock({ code }) {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <pre>{code}</pre>
      <button onClick={() => setEditing(true)}>編集</button>
      {editing && (
        <Suspense fallback={<div>エディタを読み込み中...</div>}>
          <CodeEditor value={code} />
        </Suspense>
      )}
    </div>
  )
}
```

## プリロード戦略（modulepreload）

Vite はデフォルトで動的 import の chunk に `<link rel="modulepreload">` を注入し、ブラウザのアイドル時に将来必要なモジュールをプリロードする：

```html
<!-- Vite が自動注入するプリロードタグ -->
<link rel="modulepreload" href="/assets/Dashboard.[hash].js" />
<link rel="modulepreload" href="/assets/charts.[hash].js" />
```

デフォルトの挙動は現在ルートの chunk をプリロードすることである。よりきめ細かな制御が必要な場面では、`vite-plugin-pwa` やカスタムプリロード戦略が使用できる：

```typescript
// カスタムプリロード戦略：ユーザーがリンクをホバーした時にプリロード
function prefetchOnHover() {
  const links = document.querySelectorAll('a[href]')

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const href = entry.target.getAttribute('href')
        // ルートに対応する chunk を取得してプリロード
        import(/* webpackPrefetch: true */ `./pages${href}`)
        observer.unobserve(entry.target)
      }
    })
  })

  links.forEach((link) => observer.observe(link))
}
```

Vite の `build.modulePreload` 設定：

```javascript
export default defineConfig({
  build: {
    modulePreload: {
      // プリロード polyfill（デフォルト true）
      polyfill: true,
      // カスタムプリロードロジック
      resolveDependencies(filename, deps, { hostId, hostType }) {
        if (hostId.endsWith('/Dashboard')) {
          // Dashboard ページが依存するチャートライブラリをプリロード
          return [...deps, 'charts']
        }
        return deps
      },
    },
  },
})
```

## バンドルサイズ分析ツール

### rollup-plugin-visualizer

```javascript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
})
```

生成された `stats.html` は treemap で各モジュールの bundle 内の割合を可視化し、サイズ異常の依存を迅速に特定するのに役立つ。

### bundle-analyzer とカスタム分析

```typescript
// カスタムビルド分析スクリプト
import { build } from 'vite'
import { writeFileSync } from 'fs'

async function analyzeBundle() {
  const result = await build({
    logLevel: 'silent',
    build: {
      write: false,
    },
  })

  const output = result.output || result
  const analysis = output
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => ({
      name: chunk.name,
      size: chunk.code.length,
      gzipSize: require('zlib').gzipSync(chunk.code).length,
      modules: Object.keys(chunk.modules || {}).map((id) => ({
        id,
        size: chunk.modules[id].renderedLength,
      })),
    }))

  writeFileSync('bundle-analysis.json', JSON.stringify(analysis, null, 2))
  console.log('Bundle analysis written to bundle-analysis.json')
}

analyzeBundle()
```

## Tree Shaking の仕組みとよくある落とし穴

Tree Shaking は ES Module の静的構造に依存する：コンパイラはコードを実行せずに import/export 関係を分析し、未使用の export をマークして生成段階で削除できる。

### 落とし穴 1：CommonJS モジュール

```typescript
// ❌ CommonJS フォーマット：Tree Shaking が失効
const lodash = require('lodash') // lodash 全体がパッケージされる

// ✅ ESM フォーマット：Tree Shaking が有効
import debounce from 'lodash/debounce' // debounce のみパッケージ
// または
import { debounce } from 'lodash-es' // lodash-es は ESM 版
```

Vite は `optimizeDeps` で CommonJS 依存を ESM フォーマットに事前ビルドするが、エクスポート構造を変更することはできない。ライブラリ自体がオンデマンドエクスポートをサポートしていない場合、Tree Shaking は依然として無効である。

### 落とし穴 2：副作用

```javascript
// package.json
{
  "sideEffects": false  // バンドラーに：このパッケージは副作用なし、安全に Tree Shake 可
}
```

ライブラリの `package.json` が `sideEffects` を宣言していない場合、バンドラーは保守的にすべてのモジュールを保持する。よくある落とし穴：

```typescript
// グローバル CSS のインポートには副作用あり
import './styles/global.css' // Tree Shake されない

// Polyfill のインポートには副作用あり
import 'core-js/stable' // Tree Shake されない

// 一部ライブラリのエントリファイルには初期化ロジックあり
import 'some-lib' // エクスポートが未使用でも保持される
```

### 落とし穴 3：動的プロパティアクセス

```typescript
// ❌ 動的プロパティアクセス：バンドラーは静的分析不可
import * as utils from './utils'
const fn = utils[`format${type}`] // どの関数が使用されたか確定不可

// ✅ 静的インポート：バンドラーが分析可能
import { formatDate } from './utils'
const fn = formatDate
```

## CSS コード分割と抽出

Vite はデフォルトで CSS コード分割を有効にしている：各非同期 chunk の CSS は独立ファイルに抽出され、chunk 読み込み時に自動注入される。

```javascript
export default defineConfig({
  build: {
    cssCodeSplit: true, // デフォルト true
  },
})
```

CSS 分割の挙動：

```typescript
// Dashboard.tsx
import './Dashboard.css' // この CSS は Dashboard.[hash].css に抽出される

function Dashboard() {
  return <div className="dashboard">...</div>
}

export default Dashboard
```

Dashboard chunk が動的読み込みされる時、Vite は対応する CSS ファイルも同時に読み込む。このメカニズムは自動的で、追加設定は不要である。

CSS-in-JS ソリューション（styled-components、emotion など）では、CSS は独立ファイルに抽出されず実行時に注入される。これは初回レンダリングのブロックや FOUC（Flash of Unstyled Content）を引き起こす可能性がある。初回レンダリング性能が重要指標の場合、CSS Modules や Tailwind などのゼロ実行時ソリューションの使用を推奨する。

## 実践ケース：500KB 初回 bundle を 80KB に最適化

### 最適化前：問題診断

```
Initial bundle: 512KB (gzip: 168KB)
- react-core: 142KB
- ui-lib (antd): 198KB
- charts (recharts): 89KB
- app code: 83KB
```

主な問題：

1. antd の全量インポート
2. recharts の静的インポート
3. 全ページの静的インポート
4. ユーティリティ関数のオンデマンド読み込みなし

### 最適化ステップ

**Step 1: antd のオンデマンドインポート**

```typescript
// ❌ 最適化前
import { Button, Input, Select, Table, Modal, DatePicker } from 'antd'

// ✅ 最適化後（Vite 6+ は自動処理だが、ESM インポートを確保）
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
// または babel-plugin-import を使用（antd バージョンが古い場合）
```

効果：ui-lib が 198KB から 62KB に削減

**Step 2: チャートコンポーネントの動的インポート**

```typescript
// ❌ 最適化前
import { LineChart, BarChart } from 'recharts'

// ✅ 最適化後
const LineChart = lazy(() =>
  import('recharts').then(m => ({ default: m.LineChart }))
)
```

効果：charts が初回 89KB からオンデマンド読み込みに移行

**Step 3: ルートレベル分割**

```typescript
// 全ページを動的インポートに変更
const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
```

効果：app code が 83KB から 24KB に削減（初回は Home ページのコードのみ）

**Step 4: manualChunks 最適化**

```javascript
manualChunks(id) {
  if (id.includes('node_modules/react/') ||
      id.includes('node_modules/react-dom/')) {
    return 'react-core'
  }
  if (id.includes('node_modules/@ant-design')) {
    return 'antd'
  }
  if (id.includes('node_modules/recharts') ||
      id.includes('node_modules/d3-')) {
    return 'charts'
  }
  if (id.includes('node_modules')) {
    return 'vendor'
  }
}
```

### 最適化後の結果

```
Initial bundle: 78KB (gzip: 26KB)
- react-core: 42KB (gzip: 14KB)
- vendor: 8KB (gzip: 3KB)
- Home page: 18KB (gzip: 6KB)
- antd (オンデマンド): 10KB (gzip: 3KB)

Lazy loaded:
- Dashboard: 24KB (gzip: 8KB)
- Settings: 12KB (gzip: 4KB)
- charts: 89KB (gzip: 28KB)
- editor: 245KB (gzip: 78KB)
```

初回 bundle が 512KB から 78KB に削減され、gzip 後はわずか 26KB。基本方針：**初回は初回レンダリングに必要なコードのみ読み込む**。

## 性能予算と CI 統合

```yaml
# .github/workflows/bundle-check.yml
name: Bundle Size Check
on: [pull_request]

jobs:
  bundle-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: pnpm install
      - name: Build
        run: pnpm build
      - name: Check bundle size
        run: |
          INITIAL_SIZE=$(find dist/assets -name '*.js' | \
            xargs gzip -c | wc -c)
          MAX_SIZE=$((80 * 1024))  # 80KB gzip
          if [ "$INITIAL_SIZE" -gt "$MAX_SIZE" ]; then
            echo "❌ Initial bundle size: $INITIAL_SIZE bytes (max: $MAX_SIZE)"
            exit 1
          fi
          echo "✅ Initial bundle size: $INITIAL_SIZE bytes"
```

`size-limit` でよりきめ細かな制御を行う：

```json
// .size-limit.json
[
  {
    "name": "Initial bundle",
    "path": "dist/assets/index-*.js",
    "limit": "80 KB",
    "gzip": true
  },
  {
    "name": "Dashboard chunk",
    "path": "dist/assets/Dashboard-*.js",
    "limit": "30 KB",
    "gzip": true
  },
  {
    "name": "Total assets",
    "path": "dist/assets/**/*",
    "limit": "500 KB",
    "gzip": true
  }
]
```

```json
// package.json
{
  "scripts": {
    "size": "size-limit",
    "ci": "pnpm build && pnpm size"
  }
}
```

## 個人的見解

コード分割は一度きりの最適化ではなく、継続的なプロセスである。プロジェクトのイテレーション中、新しい依存が導入され、新しいページが追加され、初回 bundle は知らず知らずのうちに膨張する。性能予算の価値は「制限」ではなく「膨張を可視化する」ことにある——CI が bundle の超過を報告した時、チームは明確な意思決定を行う必要がある：コードを最適化するか、予算を調整するか。

実践において、最もよくある bundle 膨張の原因は技術的な問題ではなく協業の問題である：開発者が新しい依存を導入する際、サイズへの影響を考慮していない。`import { debounce } from 'lodash'` は無害に見えるが、Tree Shaking の保証がなければ lodash 全体がパッケージされる。依存審査プロセスの構築（PR で新規依存のサイズを自動報告）は、事後最適化より効果的である。

最後に、過度な分割を追求しないこと。初回 bundle を 500KB から 80KB に最適化する価値はあるが、80KB から 60KB には多大な労力が必要で効果は限定的である。性能最適化は ROI（費用対効果）に注目すべきである——ユーザーの体感に最も影響のある箇所に時間を費やす。

## まとめ

Vite の本番ビルドは Rollup/Rolldown でコード分割を実現する。`manualChunks` で依存グループを制御し、動的 import でルートとコンポーネントレベルの分割を実現し、`modulepreload` で将来必要なモジュールをプリロードする。Tree Shaking は ESM の静的構造に依存し、CommonJS モジュール、副作用、動的プロパティアクセスなどの落とし穴に注意が必要である。CSS コード分割は非同期 chunk のスタイルを自動的に独立ファイルに抽出する。オンデマンドインポート、ルートレベル分割、manualChunks 設定により、初回 bundle を 500KB から 80KB に最適化できる。性能予算と CI 統合は、最適化効果がイテレーション中に後退しないことを保証する。
