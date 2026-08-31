---
title: "Vite 构建产物分析与代码分割策略：从 Bundle 到运行时"
date: 2026-07-12 11:15:41
tags:
  - Vite
  - 工程化
readingTime: 9
description: "Vite 生产构建基于 Rollup/Rolldown 打包，代码分割策略直接影响首屏性能。本文详解 manualChunks 配置、动态 import、modulepreload 预加载、Tree Shaking 陷阱和 CSS 分割，展示将 500KB 首屏 bundle 优化到 80KB 的完整过程。"
wordCount: 1586
---

Vite 的开发体验已经成为前端工具链的标杆，但生产构建的性能优化仍然是很多团队的盲区。dev 模式下按需加载的 ESM 模块在生产环境会被打包成静态资源，这个过程中的代码分割策略、预加载机制和 Tree Shaking 效果直接决定了用户的首屏体验。

## Vite 生产构建的打包机制

Vite 的生产构建在 6.x 版本前基于 Rollup，6.x 开始引入 Rolldown（Rust 实现的 Rollup 兼容替代）。两者的配置接口基本一致，但 Rolldown 在大型项目的构建速度上有显著提升。

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
        // 代码分割后的 chunk 命名
        chunkFileNames: 'assets/[name].[hash].js',
        // 静态资源命名
        assetFileNames: 'assets/[name].[hash].[ext]',
        // 高级代码分割配置
        manualChunks(id) {
          // 逻辑见下文
        },
      },
    },
  },
})
```

构建流程的核心步骤：

1. **模块解析**：从入口开始，递归解析 import/require 依赖
2. **Tree Shaking**：标记未使用的 export，在生成阶段移除
3. **代码分割**：根据动态 import 和 manualChunks 配置分割 chunk
4. **Chunk 合并**：将满足分割条件的模块合并到同一 chunk
5. **代码生成**：输出最终的 JS/CSS 文件，注入 modulepreload
6. **压缩**：esbuild 或 terser 压缩

## manualChunks 配置策略

`manualChunks` 是控制代码分割最直接的配置。默认情况下，Vite 只会将动态 import 的模块分割为独立 chunk，其余全部打入入口 chunk。对于中大型项目，这会导致入口 chunk 膨胀。

### 基础策略：按依赖类型分割

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // node_modules 中的依赖
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
            // 其他第三方依赖
            return 'vendor'
          }
        },
      },
    },
  },
})
```

### 进阶策略：按路由和功能分割

```javascript
manualChunks(id) {
  // React 核心运行时
  if (id.includes('node_modules/react/') ||
      id.includes('node_modules/react-dom/') ||
      id.includes('node_modules/scheduler/')) {
    return 'react-core'
  }

  // 路由库
  if (id.includes('node_modules/react-router') ||
      id.includes('node_modules/@remix-run')) {
    return 'router'
  }

  // 状态管理
  if (id.includes('node_modules/zustand') ||
      id.includes('node_modules/jotai') ||
      id.includes('node_modules/@reduxjs')) {
    return 'state'
  }

  // UI 组件库
  if (id.includes('node_modules/@radix-ui') ||
      id.includes('node_modules/framer-motion')) {
    return 'ui-lib'
  }

  // 工具库
  if (id.includes('node_modules/lodash') ||
      id.includes('node_modules/dayjs') ||
      id.includes('node_modules/clsx')) {
    return 'utils'
  }

  // 图表库（体积大，按需加载）
  if (id.includes('node_modules/recharts') ||
      id.includes('node_modules/d3-') ||
      id.includes('node_modules/chart.js')) {
    return 'charts'
  }

  // 编辑器（体积大，按需加载）
  if (id.includes('node_modules/monaco-editor') ||
      id.includes('node_modules/@codemirror')) {
    return 'editor'
  }
}
```

### 避免过度分割

```javascript
// ❌ 过度分割：每个 npm 包一个 chunk
manualChunks(id) {
  if (id.includes('node_modules')) {
    const match = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
    return match ? match[1] : 'vendor'
  }
}
```

过度分割会导致大量小 chunk，增加 HTTP 请求数量。在 HTTP/2 环境下，请求开销虽然降低了，但浏览器的并发解析和编译开销仍然不可忽略。经验法则是：每个 chunk 不小于 5KB，vendor chunk 不超过 5 个。

## 动态 import 与路由级代码分割

路由级代码分割是减少首屏 bundle 最有效的手段。以 React Router 为例：

```typescript
// ❌ 静态导入：所有路由打包到首屏
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

// ✅ 动态导入：按路由分割
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

Vue Router 的路由级分割更简洁：

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

### 组件级代码分割

除了路由级别，重量级组件也应该按需加载：

```typescript
// 图表组件：只在需要时加载
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

// 编辑器组件：延迟加载
const CodeEditor = lazy(() => import('./components/CodeEditor'))

function CodeBlock({ code }) {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <pre>{code}</pre>
      <button onClick={() => setEditing(true)}>编辑</button>
      {editing && (
        <Suspense fallback={<div>加载编辑器...</div>}>
          <CodeEditor value={code} />
        </Suspense>
      )}
    </div>
  )
}
```

## 预加载策略（modulepreload）

Vite 默认为动态 import 的 chunk 注入 `<link rel="modulepreload">`，在浏览器空闲时预加载未来需要的模块：

```html
<!-- Vite 自动注入的预加载标签 -->
<link rel="modulepreload" href="/assets/Dashboard.[hash].js" />
<link rel="modulepreload" href="/assets/charts.[hash].js" />
```

默认行为是对当前路由的 chunk 做预加载。对于需要更精细控制的场景，可以使用 `vite-plugin-pwa` 或自定义预加载策略：

```typescript
// 自定义预加载策略：用户 hover 链接时预加载
function prefetchOnHover() {
  const links = document.querySelectorAll('a[href]')

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const href = entry.target.getAttribute('href')
        // 获取路由对应的 chunk 并预加载
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
      // 预加载 polyfill（默认 true）
      polyfill: true,
      // 自定义预加载逻辑
      resolveDependencies(filename, deps, { hostId, hostType }) {
        if (hostId.endsWith('/Dashboard')) {
          // Dashboard 页面预加载其依赖的图表库
          return [...deps, 'charts']
        }
        return deps
      },
    },
  },
})
```

## 包体积分析工具

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

生成的 `stats.html` 以 treemap 可视化每个模块在 bundle 中的占比，帮助快速定位体积异常的依赖。

### bundle-analyzer 和自定义分析

```typescript
// 自定义构建分析脚本
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

## Tree Shaking 的工作原理和常见陷阱

Tree Shaking 依赖 ES Module 的静态结构：编译器可以在不执行代码的情况下分析 import/export 关系，标记未使用的 export 并在生成阶段移除。

### 陷阱 1：CommonJS 模块

```typescript
// ❌ CommonJS 格式：Tree Shaking 失效
const lodash = require('lodash') // 整个 lodash 被打包

// ✅ ESM 格式：Tree Shaking 生效
import debounce from 'lodash/debounce' // 只打包 debounce
// 或
import { debounce } from 'lodash-es' // lodash-es 是 ESM 版本
```

Vite 会通过 `optimizeDeps` 预构建 CommonJS 依赖为 ESM 格式，但无法改变其导出结构。如果库本身不支持按需导出，Tree Shaking 仍然无效。

### 陷阱 2：副作用

```javascript
// package.json
{
  "sideEffects": false  // 告诉打包器：本包无副作用，可安全 Tree Shake
}
```

如果库的 `package.json` 没有声明 `sideEffects`，打包器会保守地保留所有模块。常见的坑：

```typescript
// 全局 CSS 导入有副作用
import './styles/global.css' // 不会被 Tree Shake

// Polyfill 导入有副作用
import 'core-js/stable' // 不会被 Tree Shake

// 某些库的入口文件有初始化逻辑
import 'some-lib' // 即使没用到导出，也会被保留
```

### 陷阱 3：动态属性访问

```typescript
// ❌ 动态属性访问：打包器无法静态分析
import * as utils from './utils'
const fn = utils[`format${type}`] // 无法确定使用了哪个函数

// ✅ 静态导入：打包器可以分析
import { formatDate } from './utils'
const fn = formatDate
```

## CSS 代码分割与提取

Vite 默认开启 CSS 代码分割：每个异步 chunk 的 CSS 会被提取为独立文件，在加载 chunk 时自动注入。

```javascript
export default defineConfig({
  build: {
    cssCodeSplit: true, // 默认 true
  },
})
```

CSS 分割的行为：

```typescript
// Dashboard.tsx
import './Dashboard.css' // 这个 CSS 会被提取到 Dashboard.[hash].css

function Dashboard() {
  return <div className="dashboard">...</div>
}

export default Dashboard
```

当 Dashboard chunk 被动态加载时，Vite 会同时加载对应的 CSS 文件。这个机制是自动的，无需额外配置。

对于 CSS-in-JS 方案（如 styled-components、emotion），CSS 不会被提取为独立文件，而是在运行时注入。这可能导致首屏渲染阻塞和 FOUC（Flash of Unstyled Content）。如果首屏性能是关键指标，建议使用 CSS Modules 或 Tailwind 等零运行时方案。

## 实战案例：500KB 首屏优化到 80KB

### 优化前：问题诊断

```
Initial bundle: 512KB (gzip: 168KB)
- react-core: 142KB
- ui-lib (antd): 198KB
- charts (recharts): 89KB
- app code: 83KB
```

主要问题：

1. antd 全量导入
2. recharts 静态导入
3. 所有页面静态导入
4. 工具函数未按需加载

### 优化步骤

**Step 1: antd 按需导入**

```typescript
// ❌ 优化前
import { Button, Input, Select, Table, Modal, DatePicker } from 'antd'

// ✅ 优化后（Vite 6+ 自动处理，但确保使用 ESM 导入）
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
// 或使用 babel-plugin-import（如果 antd 版本较旧）
```

效果：ui-lib 从 198KB 降到 62KB

**Step 2: 图表组件动态导入**

```typescript
// ❌ 优化前
import { LineChart, BarChart } from 'recharts'

// ✅ 优化后
const LineChart = lazy(() =>
  import('recharts').then(m => ({ default: m.LineChart }))
)
```

效果：charts 从首屏 89KB 移到按需加载

**Step 3: 路由级分割**

```typescript
// 所有页面改为动态导入
const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
```

效果：app code 从 83KB 降到 24KB（只有 Home 页代码在首屏）

**Step 4: manualChunks 优化**

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

### 优化后结果

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

首屏从 512KB 降到 78KB，gzip 后仅 26KB。核心思路：**首屏只加载首屏需要的代码**。

## 性能预算与 CI 集成

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

使用 `size-limit` 进行更精细的控制：

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

## 个人观点

代码分割不是一次性优化，而是一个持续的过程。项目迭代中，新的依赖被引入、新的页面被添加，首屏 bundle 会不知不觉地膨胀。性能预算的价值不在于"限制"，而在于"让膨胀可见"——当 CI 报告 bundle 超标时，团队需要做出明确的决策：是优化代码，还是调整预算。

在实践中，我发现最常见的 bundle 膨胀原因不是技术问题，而是协作问题：开发者引入新依赖时没有考虑体积影响。一个 `import { debounce } from 'lodash'` 看似无害，但如果没有 Tree Shaking 保障，整个 lodash 就会被打包。建立依赖审查流程（PR 中自动报告新增依赖的体积）比事后优化更有效。

最后，不要追求极致的分割。将首屏 bundle 从 500KB 优化到 80KB 值得做，但从 80KB 优化到 60KB 可能需要大量精力且收益有限。性能优化要关注投入产出比——把时间花在对用户感知最明显的地方。

## 小结

Vite 的生产构建通过 Rollup/Rolldown 实现代码分割。`manualChunks` 控制依赖分组，动态 import 实现路由和组件级分割，`modulepreload` 预加载未来需要的模块。Tree Shaking 依赖 ESM 静态结构，需注意 CommonJS 模块、副作用和动态属性访问等陷阱。CSS 代码分割自动将异步 chunk 的样式提取为独立文件。通过按需导入、路由级分割和 manualChunks 配置，可将首屏 bundle 从 500KB 优化到 80KB。性能预算和 CI 集成确保优化效果在迭代中不回退。
