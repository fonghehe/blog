---
title: "Vue 3 + TypeScript Component Library Refactoring Practice"
date: 2021-10-04 14:50:28
tags:
  - Vue
  - TypeScript

readingTime: 2
description: "年初决定把团队的 Vue 2 组件库迁移到 Vue 3 + TypeScript。这个库有 50+ 组件，200+ API，迁移过程花了近 3 个月。整理一下关键的重构策略和踩过的坑。"
wordCount: 325
---

年初决定把团队的 Vue 2 组件库迁移到 Vue 3 + TypeScript。这个库有 50+ 组件，200+ API，迁移过程花了近 3 个月。整理一下关键的重构策略和踩过的坑。

## Refactoring Strategy: Incremental, Not Full Rewrite

一开始想全量重写，后来发现不现实。我们的策略是分三步：

```
第一步：搭建 Vue 3 + Vite + TypeScript 构建环境
第二步：先迁移简单组件（Button、Tag、Icon），建立模式
第三步：按优先级逐步迁移复杂组件（Table、Form、Select）
```

核心原则：新组件用 Vue 3 Composition API 写，旧组件保持可用但标记 deprecated。

## Type Definition System

组件库的类型定义是最花时间的部分，但也是收益最大的：

```typescript
// types/component.ts - 统一的类型定义

// 组件尺寸
export type ComponentSize = 'small' | 'medium' | 'large'

// 按钮类型
export type ButtonType = 'primary' | 'default' | 'danger' | 'link'

// Button Props 定义
export interface ButtonProps {
  type?: ButtonType
  size?: ComponentSize
  disabled?: boolean
  loading?: boolean
  icon?: string
  htmlType?: 'button' | 'submit' | 'reset'
}

// Button Emits 定义
export interface ButtonEmits {
  (e: 'click', event: MouseEvent): void
}

// 组件实例类型
export interface ButtonInstance {
  focus: () => void
  blur: () => void
}
```

在组件中使用：

```vue
<script setup lang="ts">
import type { ButtonProps, ButtonEmits } from '../types'

const props = withDefaults(defineProps<ButtonProps>(), {
  type: 'default',
  size: 'medium',
  disabled: false,
  loading: false,
  htmlType: 'button'
})

const emit = defineEmits<ButtonEmits>()

const handleClick = (e: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', e)
  }
}

// 暴露实例方法
defineExpose({
  focus: () => buttonRef.value?.focus(),
  blur: () => buttonRef.value?.blur()
})
</script>

<template>
  <button
    ref="buttonRef"
    :type="htmlType"
    :class="[
      'btn',
      `btn--${type}`,
      `btn--${size}`,
      { 'btn--disabled': disabled, 'btn--loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="btn__loading-icon" />
    <slot />
  </button>
</template>
```

## Slot Type Inference

Vue 3.2+ 的 `defineSlots` 让插槽也有类型：

```vue
<script setup lang="ts">
interface TableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
}

const props = defineProps<TableProps<any>>()

// 3.2+ 的 defineSlots
defineSlots<{
  // 默认插槽
  default(props: { row: any; index: number }): any
  // 具名插槽
  header(props: { columns: TableColumn<any>[] }): any
  // 作用域插槽可以自定义名称
  'cell-status'(props: { row: any; value: any }): any
}>()
</script>
```

## Build Configuration

用 Vite Library Mode 构建组件库：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CompanyUI',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})

// src/index.ts
export { default as Button } from './components/Button/index.vue'
export { default as Table } from './components/Table/index.vue'
export { default as Form } from './components/Form/index.vue'

// 导出类型
export type { ButtonProps, TableProps, FormProps } from './types'
```

## Biggest Migration Pitfall: v-model Changes

Vue 3 的 `v-model` 语义和 Vue 2 不同，这是迁移中改代码最多的地方：

```vue
<!-- Vue 2 -->
<!-- props: value, event: input -->
<MyInput v-model="name" />
<MyDialog :visible.sync="show" />

<!-- Vue 3 -->
<!-- props: modelValue, event: update:modelValue -->
<MyInput v-model="name" />
<MyDialog v-model:visible="show" />
```

我们的解决方案是写了一个 ESLint 规则，在迁移期间自动检测 Vue 2 风格的 props。

## Summary

- 渐进式迁移比全量重写更现实，先迁移简单组件建立模式
- TypeScript 类型定义体系是组件库的核心资产，值得花时间
- Vite Library Mode 简化了构建配置
- `v-model` 语义变化是最大的 breaking change，需要系统性处理
- Vue 3.2+ 的 `defineSlots` 和 `defineExpose` 让组件 API 更完整