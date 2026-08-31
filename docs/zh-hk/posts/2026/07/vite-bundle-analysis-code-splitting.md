---
title: "Vite 構建產物分析與代碼分割策略：從 Bundle 到運行時"
date: 2026-07-12 11:15:41
tags:
  - Vite
  - 工程化
readingTime: 9
description: "Vite 生產構建基於 Rollup/Rolldown 打包，代碼分割策略直接影響首屏性能。本文詳解 manualChunks 配置、動態 import、modulepreload 預加載、Tree Shaking 陷阱和 CSS 分割，展示將 500KB 首屏 bundle 優化到 80KB 的完整過程。"
wordCount: 1586
---

Vite 的開發體驗已經成爲前端工具鏈的標杆，但生產構建的性能優化仍然是很多團隊的盲區。dev 模式下按需加載的 ESM 模塊在生產環境會被打包成靜態資源，這個過程中的代碼分割策略、預加載機制和 Tree Shaking 效果直接決定了用戶的首屏體驗。

## Vite 生產構建的打包機制

Vite 的生產構建在 6.x 版本前基於 Rollup，6.x 開始引入 Rolldown（Rust 實現的 Rollup 兼容替代）。兩者的配置接口基本一致，但 Rolldown 在大型項目的構建速度上有顯著提升。

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
        // 入口文件命名
        entryFileNames: 'assets/[name].[hash].js',
        // 代碼分割後的 chunk 命名
        chunkFileNames: 'assets/[name].[hash].js',
        // 靜態資源命名
        assetFileNames: 'assets/[name].[hash].[ext]',
        // 高級代碼分割配置
        manualChunks(id) {
          // 邏輯見下文
        },
      },
    },
  },
})
```

構建流程的核心步驟：

1. **模塊解析**：從入口開始，遞歸解析 import/require 依賴
2. **Tree Shaking**：標記未使用的 export，在生成階段移除
3. **代碼分割**：根據動態 import 和 manualChunks 配置分割 chunk
4. **Chunk 合併**：將滿足分割條件的模塊合併到同一 chunk
5. **代碼生成**：輸出最終的 JS/CSS 文件，注入 modulepreload
6. **壓縮**：esbuild 或 terser 壓縮

## manualChunks 配置策略

`manualChunks` 是控制代碼分割最直接的配置。默認情況下，Vite 只會將動態 import 的模塊分割爲獨立 chunk，其餘全部打入入口 chunk。對於中大型項目，這會導致入口 chunk 膨脹。

### 基礎策略：按依賴類型分割

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // node_modules 中的依賴
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
            // 其他第三方依賴
            return 'vendor'
          }
        },
      },
    },
  },
})
```

### 進階策略：按路由和功能分割

```javascript
manualChunks(id) {
  // React 核心運行時
  if (id.includes('node_modules/react/') ||
      id.includes('node_modules/react-dom/') ||
      id.includes('node_modules/scheduler/')) {
    return 'react-core'
  }

  // 路由庫
  if (id.includes('node_modules/react-router') ||
      id.includes('node_modules/@remix-run')) {
    return 'router'
  }

  // 狀態管理
  if (id.includes('node_modules/zustand') ||
      id.includes('node_modules/jotai') ||
      id.includes('node_modules/@reduxjs')) {
    return 'state'
  }

  // UI 組件庫
  if (id.includes('node_modules/@radix-ui') ||
      id.includes('node_modules/framer-motion')) {
    return 'ui-lib'
  }

  // 工具庫
  if (id.includes('node_modules/lodash') ||
      id.includes('node_modules/dayjs') ||
      id.includes('node_modules/clsx')) {
    return 'utils'
  }

  // 圖表庫（體積大，按需加載）
  if (id.includes('node_modules/recharts') ||
      id.includes('node_modules/d3-') ||
      id.includes('node_modules/chart.js')) {
    return 'charts'
  }

  // 編輯器（體積大，按需加載）
  if (id.includes('node_modules/monaco-editor') ||
      id.includes('node_modules/@codemirror')) {
    return 'editor'
  }
}
```

### 避免過度分割

```javascript
// ❌ 過度分割：每個 npm 包一個 chunk
manualChunks(id) {
  if (id.includes('node_modules')) {
    const match = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
    return match ? match[1] : 'vendor'
  }
}
```

過度分割會導致大量小 chunk，增加 HTTP 請求數量。在 HTTP/2 環境下，請求開銷雖然降低了，但瀏覽器的並發解析和編譯開銷仍然不可忽略。經驗法則是：每個 chunk 不小於 5KB，vendor chunk 不超過 5 個。

## 動態 import 與路由級代碼分割

路由級代碼分割是減少首屏 bundle 最有效的手段。以 React Router 爲例：

```typescript
// ❌ 靜態導入：所有路由打包到首屏
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

// ✅ 動態導入：按路由分割
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

Vue Router 的路由級分割更簡潔：

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

### 組件級代碼分割

除了路由級別，重量級組件也應該按需加載：

```typescript
// 圖表組件：只在需要時加載
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

// 編輯器組件：延遲加載
const CodeEditor = lazy(() => import('./components/CodeEditor'))

function CodeBlock({ code }) {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <pre>{code}</pre>
      <button onClick={() => setEditing(true)}>編輯</button>
      {editing && (
        <Suspense fallback={<div>加載編輯器...</div>}>
          <CodeEditor value={code} />
        </Suspense>
      )}
    </div>
  )
}
```

## 預加載策略（modulepreload）

Vite 默認爲動態 import 的 chunk 注入 `<link rel="modulepreload">`，在瀏覽器空閒時預加載未來需要的模塊：

```html
<!-- Vite 自動注入的預加載標籤 -->
<link rel="modulepreload" href="/assets/Dashboard.[hash].js" />
<link rel="modulepreload" href="/assets/charts.[hash].js" />
```

默認行爲是對當前路由的 chunk 做預加載。對於需要更精細控制的場景，可以使用 `vite-plugin-pwa` 或自定義預加載策略：

```typescript
// 自定義預加載策略：用戶 hover 鏈接時預加載
function prefetchOnHover() {
  const links = document.querySelectorAll('a[href]')

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const href = entry.target.getAttribute('href')
        // 獲取路由對應的 chunk 並預加載
        import(/* webpackPrefetch: true */ `./pages${href}`)
        observer.unobserve(entry.target)
      }
    })
  })

  links.forEach((link) => observer.observe(link))
}
```

Vite 的 `build.modulePreload` 配置：

```javascript
export default defineConfig({
  build: {
    modulePreload: {
      // 預加載 polyfill（默認 true）
      polyfill: true,
      // 自定義預加載邏輯
      resolveDependencies(filename, deps, { hostId, hostType }) {
        if (hostId.endsWith('/Dashboard')) {
          // Dashboard 頁面預加載其依賴的圖表庫
          return [...deps, 'charts']
        }
        return deps
      },
    },
  },
})
```

## 包體積分析工具

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

生成的 `stats.html` 以 treemap 可視化每個模塊在 bundle 中的佔比，幫助快速定位體積異常的依賴。

### bundle-analyzer 和自定義分析

```typescript
// 自定義構建分析腳本
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

## Tree Shaking 的工作原理和常見陷阱

Tree Shaking 依賴 ES Module 的靜態結構：編譯器可以在不執行代碼的情況下分析 import/export 關係，標記未使用的 export 並在生成階段移除。

### 陷阱 1：CommonJS 模塊

```typescript
// ❌ CommonJS 格式：Tree Shaking 失效
const lodash = require('lodash') // 整個 lodash 被打包

// ✅ ESM 格式：Tree Shaking 生效
import debounce from 'lodash/debounce' // 只打包 debounce
// 或
import { debounce } from 'lodash-es' // lodash-es 是 ESM 版本
```

Vite 會通過 `optimizeDeps` 預構建 CommonJS 依賴爲 ESM 格式，但無法改變其導出結構。如果庫本身不支持按需導出，Tree Shaking 仍然無效。

### 陷阱 2：副作用

```javascript
// package.json
{
  "sideEffects": false  // 告訴打包器：本包無副作用，可安全 Tree Shake
}
```

如果庫的 `package.json` 沒有聲明 `sideEffects`，打包器會保守地保留所有模塊。常見的坑：

```typescript
// 全局 CSS 導入有副作用
import './styles/global.css' // 不會被 Tree Shake

// Polyfill 導入有副作用
import 'core-js/stable' // 不會被 Tree Shake

// 某些庫的入口文件有初始化邏輯
import 'some-lib' // 即使沒用到導出，也會被保留
```

### 陷阱 3：動態屬性訪問

```typescript
// ❌ 動態屬性訪問：打包器無法靜態分析
import * as utils from './utils'
const fn = utils[`format${type}`] // 無法確定使用了哪個函數

// ✅ 靜態導入：打包器可以分析
import { formatDate } from './utils'
const fn = formatDate
```

## CSS 代碼分割與提取

Vite 默認開啓 CSS 代碼分割：每個異步 chunk 的 CSS 會被提取爲獨立文件，在加載 chunk 時自動注入。

```javascript
export default defineConfig({
  build: {
    cssCodeSplit: true, // 默認 true
  },
})
```

CSS 分割的行爲：

```typescript
// Dashboard.tsx
import './Dashboard.css' // 這個 CSS 會被提取到 Dashboard.[hash].css

function Dashboard() {
  return <div className="dashboard">...</div>
}

export default Dashboard
```

當 Dashboard chunk 被動態加載時，Vite 會同時加載對應的 CSS 文件。這個機制是自動的，無需額外配置。

對於 CSS-in-JS 方案（如 styled-components、emotion），CSS 不會被提取爲獨立文件，而是在運行時注入。這可能導致首屏渲染阻塞和 FOUC（Flash of Unstyled Content）。如果首屏性能是關鍵指標，建議使用 CSS Modules 或 Tailwind 等零運行時方案。

## 實戰案例：500KB 首屏優化到 80KB

### 優化前：問題診斷

```
Initial bundle: 512KB (gzip: 168KB)
- react-core: 142KB
- ui-lib (antd): 198KB
- charts (recharts): 89KB
- app code: 83KB
```

主要問題：

1. antd 全量導入
2. recharts 靜態導入
3. 所有頁面靜態導入
4. 工具函數未按需加載

### 優化步驟

**Step 1: antd 按需導入**

```typescript
// ❌ 優化前
import { Button, Input, Select, Table, Modal, DatePicker } from 'antd'

// ✅ 優化後（Vite 6+ 自動處理，但確保使用 ESM 導入）
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
// 或使用 babel-plugin-import（如果 antd 版本較舊）
```

效果：ui-lib 從 198KB 降到 62KB

**Step 2: 圖表組件動態導入**

```typescript
// ❌ 優化前
import { LineChart, BarChart } from 'recharts'

// ✅ 優化後
const LineChart = lazy(() =>
  import('recharts').then(m => ({ default: m.LineChart }))
)
```

效果：charts 從首屏 89KB 移到按需加載

**Step 3: 路由級分割**

```typescript
// 所有頁面改爲動態導入
const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
```

效果：app code 從 83KB 降到 24KB（只有 Home 頁代碼在首屏）

**Step 4: manualChunks 優化**

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

### 優化後結果

```
Initial bundle: 78KB (gzip: 26KB)
- react-core: 42KB (gzip: 14KB)
- vendor: 8KB (gzip: 3KB)
- Home page: 18KB (gzip: 6KB)
- antd (按需): 10KB (gzip: 3KB)

Lazy loaded:
- Dashboard: 24KB (gzip: 8KB)
- Settings: 12KB (gzip: 4KB)
- charts: 89KB (gzip: 28KB)
- editor: 245KB (gzip: 78KB)
```

首屏從 512KB 降到 78KB，gzip 後僅 26KB。核心思路：**首屏只加載首屏需要的代碼**。

## 性能預算與 CI 集成

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

使用 `size-limit` 進行更精細的控制：

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

## 個人觀點

代碼分割不是一次性優化，而是一個持續的過程。項目迭代中，新的依賴被引入、新的頁面被添加，首屏 bundle 會不知不覺地膨脹。性能預算的價值不在於"限制"，而在於"讓膨脹可見"——當 CI 報告 bundle 超標時，團隊需要做出明確的決策：是優化代碼，還是調整預算。

在實踐中，我發現最常見的 bundle 膨脹原因不是技術問題，而是協作問題：開發者引入新依賴時沒有考慮體積影響。一個 `import { debounce } from 'lodash'` 看似無害，但如果沒有 Tree Shaking 保障，整個 lodash 就會被打包。建立依賴審查流程（PR 中自動報告新增依賴的體積）比事後優化更有效。

最後，不要追求極致的分割。將首屏 bundle 從 500KB 優化到 80KB 值得做，但從 80KB 優化到 60KB 可能需要大量精力且收益有限。性能優化要關注投入產出比——把時間花在對用戶感知最明顯的地方。

## 小結

Vite 的生產構建通過 Rollup/Rolldown 實現代碼分割。`manualChunks` 控制依賴分組，動態 import 實現路由和組件級分割，`modulepreload` 預加載未來需要的模塊。Tree Shaking 依賴 ESM 靜態結構，需注意 CommonJS 模塊、副作用和動態屬性訪問等陷阱。CSS 代碼分割自動將異步 chunk 的樣式提取爲獨立文件。通過按需導入、路由級分割和 manualChunks 配置，可將首屏 bundle 從 500KB 優化到 80KB。性能預算和 CI 集成確保優化效果在迭代中不回退。
