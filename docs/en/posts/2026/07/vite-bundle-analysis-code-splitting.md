---
title: "Vite Bundle Analysis and Code Splitting Strategy: From Bundle to Runtime"
date: 2026-07-12 11:15:41
tags:
  - Vite
  - Engineering
readingTime: 8
description: "Vite's production build is powered by Rollup/Rolldown. Code splitting strategy directly impacts first-screen performance. This article covers manualChunks configuration, dynamic imports, modulepreload, Tree Shaking pitfalls, and CSS splitting — demonstrating the complete process of optimizing a 500KB initial bundle down to 80KB."
wordCount: 943
---

Vite's development experience has become the benchmark for frontend tooling, but production build performance optimization remains a blind spot for many teams. The on-demand ESM modules in dev mode are bundled into static assets in production, and the code splitting strategy, preload mechanisms, and Tree Shaking effectiveness in this process directly determine the user's first-screen experience.

## Vite's Production Build Bundling Mechanism

Vite's production build was based on Rollup before version 6.x, and 6.x introduced Rolldown (a Rust-based Rollup-compatible replacement). Both have essentially the same configuration interface, but Rolldown significantly improves build speed for large projects.

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
        // Entry file naming
        entryFileNames: 'assets/[name].[hash].js',
        // Chunk naming after code splitting
        chunkFileNames: 'assets/[name].[hash].js',
        // Static asset naming
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Advanced code splitting configuration
        manualChunks(id) {
          // Logic below
        },
      },
    },
  },
})
```

Core build pipeline steps:

1. **Module resolution**: Starting from the entry, recursively resolve import/require dependencies
2. **Tree Shaking**: Mark unused exports, remove during generation
3. **Code splitting**: Split chunks based on dynamic imports and manualChunks configuration
4. **Chunk merging**: Merge modules meeting split conditions into the same chunk
5. **Code generation**: Output final JS/CSS files, inject modulepreload
6. **Minification**: esbuild or terser compression

## manualChunks Configuration Strategy

`manualChunks` is the most direct configuration for controlling code splitting. By default, Vite only splits dynamically imported modules into separate chunks; everything else goes into the entry chunk. For medium-to-large projects, this causes the entry chunk to bloat.

### Basic Strategy: Split by Dependency Type

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Dependencies in node_modules
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
            // Other third-party dependencies
            return 'vendor'
          }
        },
      },
    },
  },
})
```

### Advanced Strategy: Split by Route and Functionality

```javascript
manualChunks(id) {
  // React core runtime
  if (id.includes('node_modules/react/') ||
      id.includes('node_modules/react-dom/') ||
      id.includes('node_modules/scheduler/')) {
    return 'react-core'
  }

  // Router library
  if (id.includes('node_modules/react-router') ||
      id.includes('node_modules/@remix-run')) {
    return 'router'
  }

  // State management
  if (id.includes('node_modules/zustand') ||
      id.includes('node_modules/jotai') ||
      id.includes('node_modules/@reduxjs')) {
    return 'state'
  }

  // UI component library
  if (id.includes('node_modules/@radix-ui') ||
      id.includes('node_modules/framer-motion')) {
    return 'ui-lib'
  }

  // Utility libraries
  if (id.includes('node_modules/lodash') ||
      id.includes('node_modules/dayjs') ||
      id.includes('node_modules/clsx')) {
    return 'utils'
  }

  // Chart libraries (large, load on demand)
  if (id.includes('node_modules/recharts') ||
      id.includes('node_modules/d3-') ||
      id.includes('node_modules/chart.js')) {
    return 'charts'
  }

  // Editor (large, load on demand)
  if (id.includes('node_modules/monaco-editor') ||
      id.includes('node_modules/@codemirror')) {
    return 'editor'
  }
}
```

### Avoid Over-Splitting

```javascript
// ❌ Over-splitting: one chunk per npm package
manualChunks(id) {
  if (id.includes('node_modules')) {
    const match = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
    return match ? match[1] : 'vendor'
  }
}
```

Over-splitting creates many small chunks, increasing HTTP request count. Even with HTTP/2 reducing request overhead, the browser's concurrent parsing and compilation overhead remains non-negligible. The rule of thumb: each chunk should be no smaller than 5KB, and vendor chunks should not exceed 5.

## Dynamic Imports and Route-Level Code Splitting

Route-level code splitting is the most effective way to reduce the initial bundle. Using React Router as an example:

```typescript
// ❌ Static imports: all routes bundled into the initial load
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

// ✅ Dynamic imports: split by route
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

Vue Router's route-level splitting is even more concise:

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

### Component-Level Code Splitting

Beyond the route level, heavyweight components should also be loaded on demand:

```typescript
// Chart component: only loaded when needed
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

// Editor component: lazy load
const CodeEditor = lazy(() => import('./components/CodeEditor'))

function CodeBlock({ code }) {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <pre>{code}</pre>
      <button onClick={() => setEditing(true)}>Edit</button>
      {editing && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <CodeEditor value={code} />
        </Suspense>
      )}
    </div>
  )
}
```

## Preload Strategy (modulepreload)

Vite injects `<link rel="modulepreload">` for dynamically imported chunks by default, preloading future-needed modules during browser idle time:

```html
<!-- Vite auto-injected preload tags -->
<link rel="modulepreload" href="/assets/Dashboard.[hash].js" />
<link rel="modulepreload" href="/assets/charts.[hash].js" />
```

The default behavior preloads the current route's chunks. For finer control, use `vite-plugin-pwa` or a custom preload strategy:

```typescript
// Custom preload strategy: preload when user hovers over links
function prefetchOnHover() {
  const links = document.querySelectorAll('a[href]')

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const href = entry.target.getAttribute('href')
        // Get the route's corresponding chunk and preload
        import(/* webpackPrefetch: true */ `./pages${href}`)
        observer.unobserve(entry.target)
      }
    })
  })

  links.forEach((link) => observer.observe(link))
}
```

Vite's `build.modulePreload` configuration:

```javascript
export default defineConfig({
  build: {
    modulePreload: {
      // Preload polyfill (default true)
      polyfill: true,
      // Custom preload logic
      resolveDependencies(filename, deps, { hostId, hostType }) {
        if (hostId.endsWith('/Dashboard')) {
          // Dashboard page preloads its chart library dependency
          return [...deps, 'charts']
        }
        return deps
      },
    },
  },
})
```

## Bundle Analysis Tools

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

The generated `stats.html` visualizes each module's proportion in the bundle as a treemap, helping quickly identify abnormally large dependencies.

### bundle-analyzer and Custom Analysis

```typescript
// Custom build analysis script
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

## How Tree Shaking Works and Common Pitfalls

Tree Shaking relies on the static structure of ES Modules: the compiler can analyze import/export relationships without executing code, mark unused exports, and remove them during generation.

### Pitfall 1: CommonJS Modules

```typescript
// ❌ CommonJS format: Tree Shaking fails
const lodash = require('lodash') // entire lodash gets bundled

// ✅ ESM format: Tree Shaking works
import debounce from 'lodash/debounce' // only debounce is bundled
// or
import { debounce } from 'lodash-es' // lodash-es is the ESM version
```

Vite pre-bundles CommonJS dependencies as ESM via `optimizeDeps`, but cannot change their export structure. If the library itself doesn't support on-demand exports, Tree Shaking still won't work.

### Pitfall 2: Side Effects

```javascript
// package.json
{
  "sideEffects": false  // tells the bundler: this package has no side effects, safe to Tree Shake
}
```

If a library's `package.json` doesn't declare `sideEffects`, the bundler conservatively keeps all modules. Common pitfalls:

```typescript
// Global CSS imports have side effects
import './styles/global.css' // won't be Tree Shaken

// Polyfill imports have side effects
import 'core-js/stable' // won't be Tree Shaken

// Some libraries have initialization logic in their entry files
import 'some-lib' // even if no exports are used, it will be kept
```

### Pitfall 3: Dynamic Property Access

```typescript
// ❌ Dynamic property access: bundler cannot statically analyze
import * as utils from './utils'
const fn = utils[`format${type}`] // cannot determine which function is used

// ✅ Static import: bundler can analyze
import { formatDate } from './utils'
const fn = formatDate
```

## CSS Code Splitting and Extraction

Vite enables CSS code splitting by default: each async chunk's CSS is extracted into a separate file, automatically injected when the chunk is loaded.

```javascript
export default defineConfig({
  build: {
    cssCodeSplit: true, // default true
  },
})
```

CSS splitting behavior:

```typescript
// Dashboard.tsx
import './Dashboard.css' // this CSS will be extracted to Dashboard.[hash].css

function Dashboard() {
  return <div className="dashboard">...</div>
}

export default Dashboard
```

When the Dashboard chunk is dynamically loaded, Vite simultaneously loads the corresponding CSS file. This mechanism is automatic and requires no extra configuration.

For CSS-in-JS solutions (like styled-components, emotion), CSS is not extracted into separate files but injected at runtime. This can cause first-screen render blocking and FOUC (Flash of Unstyled Content). If first-screen performance is a critical metric, consider zero-runtime solutions like CSS Modules or Tailwind.

## Case Study: Optimizing 500KB Initial Bundle to 80KB

### Before: Problem Diagnosis

```
Initial bundle: 512KB (gzip: 168KB)
- react-core: 142KB
- ui-lib (antd): 198KB
- charts (recharts): 89KB
- app code: 83KB
```

Main issues:

1. Full antd imports
2. Static recharts imports
3. All pages statically imported
4. Utility functions not loaded on demand

### Optimization Steps

**Step 1: On-demand antd imports**

```typescript
// ❌ Before
import { Button, Input, Select, Table, Modal, DatePicker } from 'antd'

// ✅ After (Vite 6+ handles automatically, but ensure ESM imports)
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
// or use babel-plugin-import (for older antd versions)
```

Effect: ui-lib dropped from 198KB to 62KB

**Step 2: Dynamic import for chart components**

```typescript
// ❌ Before
import { LineChart, BarChart } from 'recharts'

// ✅ After
const LineChart = lazy(() =>
  import('recharts').then(m => ({ default: m.LineChart }))
)
```

Effect: charts moved from 89KB initial to on-demand loading

**Step 3: Route-level splitting**

```typescript
// All pages switched to dynamic imports
const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
```

Effect: app code dropped from 83KB to 24KB (only Home page code in initial load)

**Step 4: manualChunks optimization**

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

### After Optimization

```
Initial bundle: 78KB (gzip: 26KB)
- react-core: 42KB (gzip: 14KB)
- vendor: 8KB (gzip: 3KB)
- Home page: 18KB (gzip: 6KB)
- antd (on-demand): 10KB (gzip: 3KB)

Lazy loaded:
- Dashboard: 24KB (gzip: 8KB)
- Settings: 12KB (gzip: 4KB)
- charts: 89KB (gzip: 28KB)
- editor: 245KB (gzip: 78KB)
```

Initial bundle reduced from 512KB to 78KB, only 26KB gzipped. Core principle: **only load what the first screen needs**.

## Performance Budget and CI Integration

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

Using `size-limit` for more granular control:

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

## Personal Opinion

Code splitting is not a one-time optimization but an ongoing process. As the project iterates, new dependencies are introduced and new pages are added, the initial bundle bloats imperceptibly. The value of a performance budget lies not in "restriction" but in "making bloat visible" — when CI reports a bundle size violation, the team needs to make an explicit decision: optimize the code or adjust the budget.

In practice, I've found that the most common cause of bundle bloat is not technical issues but collaboration issues: developers introduce new dependencies without considering the size impact. An `import { debounce } from 'lodash'` looks harmless, but without Tree Shaking protection, the entire lodash gets bundled. Establishing a dependency review process (automatically reporting new dependency sizes in PRs) is more effective than after-the-fact optimization.

Finally, don't pursue extreme splitting. Optimizing the initial bundle from 500KB to 80KB is worthwhile, but from 80KB to 60KB may require significant effort for diminishing returns. Performance optimization should focus on ROI — spend time where the user impact is most noticeable.

## Summary

Vite's production build achieves code splitting through Rollup/Rolldown. `manualChunks` controls dependency grouping, dynamic imports enable route and component-level splitting, and `modulepreload` preloads future-needed modules. Tree Shaking relies on ESM static structure — watch out for pitfalls like CommonJS modules, side effects, and dynamic property access. CSS code splitting automatically extracts async chunk styles into separate files. Through on-demand imports, route-level splitting, and manualChunks configuration, the initial bundle can be optimized from 500KB to 80KB. Performance budgets and CI integration ensure optimization results don't regress during iteration.
