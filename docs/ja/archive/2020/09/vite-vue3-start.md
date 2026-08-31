---
title: "Vite + Vue 3で新プロジェクトを始める完全ガイド"
date: 2020-09-07 10:27:38
tags:
  - Vue
readingTime: 5
description: "Vue 3 正式 RC 阶段了，Vite 1.0 也已经稳定。团队新起的一个内部工具项目决定直接上 Vite + Vue 3，不再用 Vue CLI + Webpack 了。这篇文章记录一下完整的搭建过程和踩坑点。"
wordCount: 739
---

Vue 3 が正式に RC 段階に入り、Vite 1.0 も安定しました。チームの新規内部ツールプロジェクトは、Vue CLI + Webpack を止めて Vite + Vue 3 に直接乗り換えることにしました。この記事は、その完全な構築手順とつまずきポイントをまとめたものです。

## なぜ Vite なのか

結論から言うと、開発体験の向上があまりにも大きいという点です。

| | Vue CLI + Webpack | Vite |
|---|---|---|
| コールドスタート | 30〜60s（大規模プロジェクト） | < 1s |
| HMR | 2〜5s | ほぼ即時 |
| ビルド | 1〜3min | 20〜40s（Rollup） |

Vite の仕組みはシンプルです。開発時はブラウザのネイティブ ESM を活用し、バンドルせずに必要な分だけコンパイルします。本番ビルドでは Rollup でバンドルします。そのため、開発サーバーは極めて高速で、ビルド成果物もきれいなものになります。

## プロジェクトの初期化

```bash
# 创建项目
npm create vite@latest my-project -- --template vue-ts

# 目录结构
my-project/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.ico
└── src/
    ├── App.vue
    ├── main.ts
    ├── components/
    │   └── HelloWorld.vue
    ├── assets/
    │   └── logo.png
    └── shims-vue.d.ts
```

## プロジェクトの設定

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@views': path.resolve(__dirname, 'src/views')
    }
  },

  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },

  build: {
    // 生产构建配置
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router'],
          'ui': ['@popperjs/core']
        }
      }
    }
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  }
})
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "jsx": "preserve",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "exclude": ["node_modules"]
}
```

### shims-vue.d.ts

```typescript
// 让 TypeScript 识别 .vue 文件
declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

## ルーティングの設定

```typescript
// src/router/index.ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    // Vite 支持动态 import 进行代码分割
    component: () => import('@/views/Dashboard.vue'),
    children: [
      {
        path: 'overview',
        component: () => import('@/views/dashboard/Overview.vue')
      },
      {
        path: 'analytics',
        component: () => import('@/views/dashboard/Analytics.vue')
      }
    ]
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

## 状態管理：単純なケースは reactive で

内部ツールであれば、必ずしも Vuex/Pinia は必要ありません。Composition API + provide/inject をそのまま使えば十分です：

```typescript
// src/stores/useAppStore.ts
import { reactive, readonly, toRefs, inject, InjectionKey } from 'vue'

interface AppState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  currentUser: {
    id: string
    name: string
    role: string
  } | null
  notifications: Array<{ id: number; message: string; read: boolean }>
}

export function createAppStore() {
  const state = reactive<AppState>({
    sidebarCollapsed: false,
    theme: 'light',
    currentUser: null,
    notifications: []
  })

  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed
  }

  function setTheme(theme: 'light' | 'dark') {
    state.theme = theme
    document.documentElement.setAttribute('data-theme', theme)
  }

  async function fetchCurrentUser() {
    const res = await fetch('/api/user/me')
    state.currentUser = await res.json()
  }

  function markNotificationRead(id: number) {
    const n = state.notifications.find(n => n.id === id)
    if (n) n.read = true
  }

  // 暴露只读状态 + 可修改的 action
  return {
    state: readonly(state),
    toggleSidebar,
    setTheme,
    fetchCurrentUser,
    markNotificationRead
  }
}

export type AppStore = ReturnType<typeof createAppStore>

export const AppStoreKey: InjectionKey<AppStore> = Symbol('AppStore')

// main.ts 中
// const app = createApp(App)
// app.provide(AppStoreKey, createAppStore())
// 组件中通过 inject(AppStoreKey) 使用
```

## コンポーザブル（Composables）

```typescript
// src/composables/useRequest.ts
import { ref, Ref } from 'vue'

interface UseRequestOptions<T> {
  immediate?: boolean
  initialData?: T
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export function useRequest<T>(
  fetcher: () => Promise<T>,
  options: UseRequestOptions<T> = {}
) {
  const data = ref<T | undefined>(options.initialData) as Ref<T | undefined>
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function execute() {
    loading.value = true
    error.value = null
    try {
      data.value = await fetcher()
      options.onSuccess?.(data.value as T)
    } catch (e) {
      error.value = e as Error
      options.onError?.(e as Error)
    } finally {
      loading.value = false
    }
  }

  if (options.immediate !== false) {
    execute()
  }

  return { data, loading, error, execute, refresh: execute }
}

// 使用
// const { data: users, loading, refresh } = useRequest(
//   () => fetch('/api/users').then(r => r.json()),
//   { immediate: true }
// )
```

## 環境変数

Vite は `.env` ファイルで環境変数を管理し、クライアントから参照するには変数名を `VITE_` で始める必要があります：

```bash
# .env.development
VITE_API_BASE=http://localhost:8080
VITE_APP_TITLE=MyApp (Dev)

# .env.production
VITE_API_BASE=https://api.example.com
VITE_APP_TITLE=MyApp
```

```typescript
// 使用
const apiBase = import.meta.env.VITE_API_BASE
const appTitle = import.meta.env.VITE_APP_TITLE

// 类型声明
// src/env.d.ts
interface ImportMetaEnv {
  VITE_API_BASE: string
  VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## よくある質問

### 1. CommonJS モジュールの互換性

Vite は ESM ベースであり、CJS 形式しか提供しない古い npm パッケージではエラーになることがあります：

```typescript
// vite.config.ts 中配置 optimizeDeps
export default defineConfig({
  optimizeDeps: {
    include: ['some-cjs-package']
  }
})
```

### 2. 静的アセットの扱い

```typescript
// Vite 中获取静态资源 URL
import logoUrl from '@/assets/logo.png'

// CSS 中引用
// background: url('@/assets/bg.png')

// 动态路径需要 new URL
function getImageUrl(name: string) {
  return new URL(`../assets/${name}.png`, import.meta.url).href
}
```

### 3. グローバルなスタイル変数

```typescript
// vite.config.ts
css: {
  preprocessorOptions: {
    scss: {
      additionalData: `@use "@/styles/variables" as *;`
    }
  }
}
```

## まとめ

- Vite の開発体験は Webpack と比べて飛躍的に向上しており、コールドスタートも HMR も待つほどのものではありません
- Vue 3 + Composition API のコンポーザブルはロジックの再利用に非常に適しています
- プロジェクト設定は vue.config.js から vite.config.ts へ移行でき、構造は似ていますがより簡潔です
- 環境変数はクライアントから参照するために `VITE_` で始める必要があります
- CJS 互換や静的アセットのパスについては、Vite 特有の要件に注意してください
- 内部プロジェクトで Webpack エコシステムのプラグインをあまり必要としないなら、Vite に直接乗り換えることをお勧めします
