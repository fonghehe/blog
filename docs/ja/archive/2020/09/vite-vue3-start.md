---
title: "Vite + Vue 3で新プロジェクトを始める完全ガイド"
date: 2020-09-07 10:27:38
tags:
  - Vue
readingTime: 4
description: "Vue 3 正式 RC 阶段了，Vite 1.0 也已经稳定。团队新起的一个内部工具项目决定直接上 Vite + Vue 3，不再用 Vue CLI + Webpack 了。这篇文章记录一下完整的搭建过程和踩坑点。"
---

Vue 3 正式 RC 阶段了，Vite 1.0 也已经稳定。团队新起的一个内部工具项目决定直接上 Vite + Vue 3，不再用 Vue CLI + Webpack 了。这篇文章记录一下完整的搭建过程和踩坑点。

## 为什么选 Vite

先说结论：开发体验提升太明显了。

| | Vue CLI + Webpack | Vite |
|---|---|---|
| 冷启动 | 30-60s（大项目） | < 1s |
| HMR | 2-5s | 几乎即时 |
| 构建 | 1-3min | 20-40s（Rollup） |

Vite 的原理很简单：开发时利用浏览器原生 ESM，不打包，按需编译。构建时用 Rollup 打包。所以开发速度极快，构建产物也很干净。

## 项目初始化

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

## 项目配置

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

## 路由配置

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

## 状态管理：简单场景用 reactive

对于内部工具，不一定需要 Vuex/Pinia，直接用 Composition API + provide/inject：

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

## 组合式函数（Composables）

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

## 环境变量

Vite 使用 `.env` 文件管理环境变量，变量必须以 `VITE_` 开头才能在客户端访问：

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

### 1. CommonJS 模块兼容

Vite 基于 ESM，某些旧的 npm 包只提供 CJS 格式会报错：

```typescript
// vite.config.ts 中配置 optimizeDeps
export default defineConfig({
  optimizeDeps: {
    include: ['some-cjs-package']
  }
})
```

### 2. 静态资源处理

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

### 3. 全局样式变量

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

- Vite 的开发体验相比 Webpack 有质的飞跃，冷启动和 HMR 快到几乎不需要等待
- Vue 3 + Composition API 的组合式函数非常适合逻辑复用
- 项目配置从 vue.config.js 迁移到 vite.config.ts，结构类似但更简洁
- 环境变量必须以 `VITE_` 开头才能在客户端使用
- 对于 CJS 兼容和静态资源路径，需要注意 Vite 的特殊要求
- 内部项目如果不需要太多 Webpack 生态插件，建议直接上 Vite
