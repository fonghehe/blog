---
title: "用 Vite + Vue 3 啟動新專案完整指南"
date: 2020-09-07 10:27:38
tags:
  - Vue
readingTime: 4
description: "Vue 3 正式 RC 階段了，Vite 1.0 也已經穩定。團隊新起的一個內部工具專案決定直接上 Vite + Vue 3，不再用 Vue CLI + Webpack 了。這篇文章記錄一下完整的搭建過程和踩坑點。"
wordCount: 424
---

Vue 3 正式 RC 階段了，Vite 1.0 也已經穩定。團隊新起的一個內部工具專案決定直接上 Vite + Vue 3，不再用 Vue CLI + Webpack 了。這篇文章記錄一下完整的搭建過程和踩坑點。

## 為什麼選 Vite

先說結論：開發體驗提升太明顯了。

| | Vue CLI + Webpack | Vite |
|
---|---|---|
| 冷啟動 | 30-60s（大專案） | < 1s |
| HMR | 2-5s | 幾乎即時 |
| 構建 | 1-3min | 20-40s（Rollup） |

Vite 的原理很簡單：開發時利用瀏覽器原生 ESM，不打包，按需編譯。構建時用 Rollup 打包。所以開發速度極快，構建產物也很乾淨。

## 專案初始化

```bash
# 建立專案
npm create vite@latest my-project -- --template vue-ts

# 目錄結構
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

## 專案設定

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
    // 生產構建配置
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
// 讓 TypeScript 識別 .vue 檔案
declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

## 路由設定

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
    // Vite 支援動態 import 進行程式碼分割
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

## 狀態管理：簡單場景用 reactive

對於內部工具，不一定需要 Vuex/Pinia，直接用 Composition API + provide/inject：

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

  // 暴露隻讀狀態 + 可修改的 action
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
// 元件中通過 inject(AppStoreKey) 使用
```

## 組合式函式（Composables）

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

## 環境變數

Vite 使用 `.env` 檔案管理環境變數，變數必須以 `VITE_` 開頭才能在客戶端訪問：

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

// 型別宣告
// src/env.d.ts
interface ImportMetaEnv {
  VITE_API_BASE: string
  VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## 常見問題

### 1. CommonJS 模組相容

Vite 基於 ESM，某些舊的 npm 包隻提供 CJS 格式會報錯：

```typescript
// vite.config.ts 中配置 optimizeDeps
export default defineConfig({
  optimizeDeps: {
    include: ['some-cjs-package']
  }
})
```

### 2. 靜態資源處理

```typescript
// Vite 中獲取靜態資源 URL
import logoUrl from '@/assets/logo.png'

// CSS 中引用
// background: url('@/assets/bg.png')

// 動態路徑需要 new URL
function getImageUrl(name: string) {
  return new URL(`../assets/${name}.png`, import.meta.url).href
}
```

### 3. 全域性樣式變數

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

## 小結

- Vite 的開發體驗相比 Webpack 有質的飛躍，冷啟動和 HMR 快到幾乎不需要等待
- Vue 3 + Composition API 的組合式函式非常適合邏輯複用
- 專案配置從 vue.config.js 遷移到 vite.config.ts，結構類似但更簡潔
- 環境變數必須以 `VITE_` 開頭才能在客戶端使用
- 對於 CJS 相容和靜態資源路徑，需要注意 Vite 的特殊要求
- 內部專案如果不需要太多 Webpack 生態外掛，建議直接上 Vite
