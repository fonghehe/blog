---
title: "Vue 3 + TypeScript 元件庫重構實踐"
date: 2021-10-04 14:50:28
tags:
  - Vue
  - TypeScript
readingTime: 2
description: "年初決定把團隊的 Vue 2 元件庫遷移到 Vue 3 + TypeScript。這個庫有 50+ 元件，200+ API，遷移過程花了近 3 個月。整理一下關鍵的重構策略和踩過的坑。"
---

年初決定把團隊的 Vue 2 元件庫遷移到 Vue 3 + TypeScript。這個庫有 50+ 元件，200+ API，遷移過程花了近 3 個月。整理一下關鍵的重構策略和踩過的坑。

## 重構策略：漸進式而非全量重寫

一開始想全量重寫，後來發現不現實。我們的策略是分三步：

```
第一步：搭建 Vue 3 + Vite + TypeScript 構建環境
第二步：先遷移簡單元件（Button、Tag、Icon），建立模式
第三步：按優先順序逐步遷移複雜元件（Table、Form、Select）
```

核心原則：新元件用 Vue 3 Composition API 寫，舊元件保持可用但標記 deprecated。

## 型別定義體系

元件庫的型別定義是最花時間的部分，但也是收益最大的：

```typescript
// types/component.ts - 統一的型別定義

// 元件尺寸
export type ComponentSize = 'small' | 'medium' | 'large'

// 按鈕型別
export type ButtonType = 'primary' | 'default' | 'danger' | 'link'

// Button Props 定義
export interface ButtonProps {
  type?: ButtonType
  size?: ComponentSize
  disabled?: boolean
  loading?: boolean
  icon?: string
  htmlType?: 'button' | 'submit' | 'reset'
}

// Button Emits 定義
export interface ButtonEmits {
  (e: 'click', event: MouseEvent): void
}

// 元件例項型別
export interface ButtonInstance {
  focus: () => void
  blur: () => void
}
```

在元件中使用：

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

// 暴露例項方法
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

## 插槽型別推斷

Vue 3.2+ 的 `defineSlots` 讓插槽也有型別：

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
  // 預設插槽
  default(props: { row: any; index: number }): any
  // 具名插槽
  header(props: { columns: TableColumn<any>[] }): any
  // 作用域插槽可以自定義名稱
  'cell-status'(props: { row: any; value: any }): any
}>()
</script>
```

## 構建配置

用 Vite Library Mode 構建元件庫：

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

// 匯出型別
export type { ButtonProps, TableProps, FormProps } from './types'
```

## 遷移中最大的坑：v-model 變化

Vue 3 的 `v-model` 語義和 Vue 2 不同，這是遷移中改程式碼最多的地方：

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

我們的解決方案是寫了一個 ESLint 規則，在遷移期間自動檢測 Vue 2 風格的 props。

## 小結

- 漸進式遷移比全量重寫更現實，先遷移簡單元件建立模式
- TypeScript 型別定義體系是元件庫的核心資產，值得花時間
- Vite Library Mode 簡化了構建配置
- `v-model` 語義變化是最大的 breaking change，需要系統性處理
- Vue 3.2+ 的 `defineSlots` 和 `defineExpose` 讓元件 API 更完整