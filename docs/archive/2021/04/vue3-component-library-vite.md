---
title: "用 Vite 搭建 Vue 3 组件库"
date: 2021-04-05 10:05:17
tags:
  - Vue
  - Vite
  - TypeScript
readingTime: 2
description: "团队计划从 Element UI 迁移到自建 Vue 3 组件库。用 Vite 做构建工具比 Rollup 或 Webpack 更简洁，特别是处理 Vue SFC 时。记录一下搭建过程。"
wordCount: 193
---

团队计划从 Element UI 迁移到自建 Vue 3 组件库。用 Vite 做构建工具比 Rollup 或 Webpack 更简洁，特别是处理 Vue SFC 时。记录一下搭建过程。

## 项目结构

```
my-ui/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.ts                  # 入口，注册所有组件
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
├── examples/                     # 开发用例
│   ├── App.vue
│   └── main.ts
└── docs/                         # 文档
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
        // 导出 CSS
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'my-ui.css'
          return assetInfo.name!
        }
      }
    }
  }
})
```

## 组件编写

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

## 入口文件和类型导出

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

// 导出类型
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

## 开发调试

用 examples 目录做开发时的 playground：

```typescript
// examples/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import MyUI from '../src'

createApp(App).use(MyUI).mount('#app')
```

```bash
# 开发模式
pnpm dev
# 浏览器打开 http://localhost:3000

# 构建
pnpm build

# 发布前检查
pnpm pack --dry-run
```

## 小结

- Vite 的 library mode 适合构建 Vue 3 组件库，配置比 Rollup 简洁
- 用 `vite-plugin-dts` 自动生成类型声明，按需引入体验更好
- `exports` 字段配合 `sideEffects` 确保 tree-shaking 生效
- Vue SFC 的 `<script setup>` 写组件很自然，类型支持也好
- 建议用 pnpm workspace 管理组件库 + 示例应用 + 文档站的 Monorepo