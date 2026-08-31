---
title: "Vue 3 + TypeScript Component Library Refactoring Practice"
date: 2021-10-04 14:50:28
tags:
  - Vue
  - TypeScript

readingTime: 2
description: "Early this year we decided to migrate our team's Vue 2 component library to Vue 3 plus TypeScript. The library has 50+ components and 200+ APIs, and the migration took nearly three months. Here are the key refactoring strategies and the pitfalls we hit."
wordCount: 248
---

At the start of the year we decided to migrate the team's Vue 2 component library to Vue 3 + TypeScript. The library has 50+ components and 200+ APIs, and the migration took nearly three months. Here's a rundown of the key refactoring strategies and the pitfalls we hit.

## Refactoring Strategy: Incremental, Not Full Rewrite

We initially wanted a full rewrite, but soon realized that wasn't realistic. Our strategy came in three steps:

```
第一步：搭建 Vue 3 + Vite + TypeScript 构建环境
第二步：先迁移简单组件（Button、Tag、Icon），建立模式
第三步：按优先级逐步迁移复杂组件（Table、Form、Select）
```

Core principle: new components are written with the Vue 3 Composition API, while old components stay usable but are marked deprecated.

## Type Definition System

The component library's type definitions took the most time, but also delivered the greatest payoff:

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

Using them in a component:

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

Vue 3.2+'s `defineSlots` also gives slots types:

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

Build the component library with Vite's Library Mode:

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

Vue 3's `v-model` semantics differ from Vue 2's, and this is where we changed the most code during the migration:

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

Our solution was to write an ESLint rule that automatically detects Vue 2-style props during the migration.

## Summary

- Incremental migration is more realistic than a full rewrite — migrate the simple components first to establish a pattern
- The TypeScript type-definition system is a core asset of the component library and worth the investment
- Vite's Library Mode simplifies the build configuration
- The `v-model` semantic change is the biggest breaking change and needs to be handled systematically
- Vue 3.2+'s `defineSlots` and `defineExpose` make the component API more complete