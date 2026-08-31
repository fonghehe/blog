---
title: "Complete Guide to Starting a New Project with Vite + Vue 3"
date: 2020-09-07 10:27:38
tags:
  - Vue
readingTime: 4
description: "A complete guide to starting a new project with Vite and Vue 3 instead of Vue CLI and Webpack, documenting the full setup process and pitfalls encountered."
wordCount: 292
---

Vue 3 has officially entered its RC phase, and Vite 1.0 is already stable. Our team decided to build a new internal tool directly on Vite + Vue 3 instead of Vue CLI + Webpack. This article records the full setup process and the pitfalls we hit.

## Why Vite

The bottom line first: the developer experience improvement is dramatic.

| | Vue CLI + Webpack | Vite |
|---|---|---|
| Cold start | 30-60s (large projects) | < 1s |
| HMR | 2-5s | near-instant |
| Build | 1-3min | 20-40s (Rollup) |

Vite's principle is simple: in development it relies on the browser's native ESM, with no bundling and compile-on-demand. For builds it uses Rollup to bundle. That makes dev extremely fast, and the build output is clean.

## Project Initialization

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

## Project Configuration

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

## Router Configuration

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

## State Management: Using reactive for Simple Cases

For an internal tool you don't necessarily need Vuex/Pinia — you can just use the Composition API + provide/inject:

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

## Composables

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

## Environment Variables

Vite manages environment variables with `.env` files, and a variable must be prefixed with `VITE_` to be accessible on the client:

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

## Common Issues

### 1. CommonJS Module Compatibility

Vite is built on ESM, and some old npm packages that only ship in CJS format will throw errors:

```typescript
// vite.config.ts 中配置 optimizeDeps
export default defineConfig({
  optimizeDeps: {
    include: ['some-cjs-package']
  }
})
```

### 2. Handling Static Assets

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

### 3. Global Style Variables

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

## Summary

- Vite's developer experience is a quantum leap over Webpack — cold start and HMR are so fast you barely wait.
- Vue 3 + the Composition API's composables are great for logic reuse.
- Project config moves from vue.config.js to vite.config.ts — similar structure, but cleaner.
- Environment variables must start with `VITE_` to be usable on the client.
- For CJS compatibility and static asset paths, mind Vite's specific requirements.
- For internal projects that don't need much of the Webpack plugin ecosystem, I'd recommend going straight to Vite.
