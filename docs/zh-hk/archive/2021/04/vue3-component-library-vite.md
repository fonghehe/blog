---
title: "用 Vite 搭建 Vue 3 組件庫"
date: 2021-04-05 10:05:17
tags:
  - Vue
  - Vite
  - TypeScript
readingTime: 2
description: "團隊計劃從 Element UI 遷移到自建 Vue 3 組件庫。用 Vite 做構建工具比 Rollup 或 Webpack 更簡潔，特別是處理 Vue SFC 時。記錄一下搭建過程。"
---

團隊計劃從 Element UI 遷移到自建 Vue 3 組件庫。用 Vite 做構建工具比 Rollup 或 Webpack 更簡潔，特別是處理 Vue SFC 時。記錄一下搭建過程。

## 項目結構

```
my-ui/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.ts                  # 入口，註冊所有組件
│   ├── button/
│   │   ├── Button.vue
│   │   ├── Button.test.ts
│   │   └── index.ts
│   ├── input/
│   │   ├── Input.vue
│   │   └── index.ts
│   └── styles/
│       ├── variables.scss
│       └── reset.scss
├── examples/                     # 開發用例
│   ├── App.vue
│   └── main.ts
└── docs/                         # 文檔
```

## Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outputDir: 'dist/types'
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyUI',
      formats: ['es', 'umd'],
      fileName: (format) => `my-ui.${format}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        },
        // 導出 CSS
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'my-ui.css'
          return assetInfo.name!
        }
      }
    }
  }
})
```

## 組件編寫

**Button.vue**：

```vue
<script setup lang="ts">
import { computed } from 'vue'

type ButtonType = 'primary' | 'success' | 'warning' | 'danger' | 'default'
type ButtonSize = 'small' | 'medium' | 'large'

interface Props {
  type?: ButtonType
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  size: 'medium',
  loading: false,
  disabled: false
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const classes = computed(() => [
  'my-btn',
  `my-btn--${props.type}`,
  `my-btn--${props.size}`,
  {
    'is-loading': props.loading,
    'is-disabled': props.disabled
  }
])

function handleClick(e: MouseEvent) {
  if (props.loading || props.disabled) return
  emit('click', e)
}
</script>

<template>
  <button :class="classes" :disabled="disabled || loading" @click="handleClick">
    <span v-if="loading" class="my-btn__loading">
      <svg class="spin" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" stroke-width="2" />
      </svg>
    </span>
    <span class="my-btn__content">
      <slot />
    </span>
  </button>
</template>

<style lang="scss" scoped>
.my-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &--primary {
    background: #409eff;
    color: #fff;
    border-color: #409eff;
  }
  &--medium { padding: 8px 16px; font-size: 14px; }
  &--small { padding: 5px 12px; font-size: 12px; }
  &--large { padding: 12px 24px; font-size: 16px; }

  &.is-disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.spin {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
```

## 入口文件和類型導出

```typescript
// src/button/index.ts
import Button from './Button.vue'

export { Button }
export type { ButtonProps } from './Button.vue'

// src/index.ts
import type { App } from 'vue'
import { Button } from './button'
import { Input } from './input'

import './styles/reset.scss'

const components = { Button, Input }

const install = (app: App) => {
  Object.entries(components).forEach(([name, component]) => {
    app.component(`My${name}`, component)
  })
}

// 支持全量引入
export default { install }

// 支持按需引入
export { Button, Input }

// 導出類型
export type { ButtonProps } from './button'
export type { InputProps } from './input'
```

## 使用方式

**全量引入**：

```typescript
// main.ts
import { createApp } from 'vue'
import MyUI from 'my-ui'
import 'my-ui/dist/my-ui.css'

createApp(App).use(MyUI).mount('#app')
```

**按需引入**：

```vue
<script setup>
import { Button } from 'my-ui'
import 'my-ui/dist/my-ui.css'
</script>

<template>
  <Button type="primary" @click="handleClick">
    Click Me
  </Button>
</template>
```

## package.json 配置

```json
{
  "name": "my-ui",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/my-ui.umd.js",
  "module": "./dist/my-ui.es.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/my-ui.es.js",
      "require": "./dist/my-ui.umd.js",
      "types": "./dist/types/index.d.ts"
    },
    "./dist/*": "./dist/*"
  },
  "files": ["dist"],
  "sideEffects": ["**/*.css"],
  "peerDependencies": {
    "vue": "^3.2.0"
  },
  "scripts": {
    "dev": "vite serve examples",
    "build": "vite build",
    "test": "jest"
  }
}
```

## 開發調試

用 examples 目錄做開發時的 playground：

```typescript
// examples/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import MyUI from '../src'

createApp(App).use(MyUI).mount('#app')
```

```bash
# 開發模式
pnpm dev
# 瀏覽器打開 http://localhost:3000

# 構建
pnpm build

# 發佈前檢查
pnpm pack --dry-run
```

## 小結

- Vite 的 library mode 適合構建 Vue 3 組件庫，配置比 Rollup 簡潔
- 用 `vite-plugin-dts` 自動生成類型聲明，按需引入體驗更好
- `exports` 字段配合 `sideEffects` 確保 tree-shaking 生效
- Vue SFC 的 `<script setup>` 寫組件很自然，類型支持也好
- 建議用 pnpm workspace 管理組件庫 + 示例應用 + 文檔站的 Monorepo