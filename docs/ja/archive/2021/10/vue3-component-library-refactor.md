---
title: "Vue 3 + TypeScript コンポーネントライブラリのリファクタリング実践"
date: 2021-10-04 14:50:28
tags:
  - Vue
  - TypeScript

readingTime: 3
description: "年初にチームの Vue 2 コンポーネントライブラリを Vue 3 + TypeScript に移行することを決定しました。このライブラリは50以上のコンポーネントと200以上の API を持ち、移行には約3ヶ月を要しました。重要なリファクタリング戦略と陥った落とし穴を整理します。"
wordCount: 628
---

年初にチームの Vue 2 コンポーネントライブラリを Vue 3 + TypeScript に移行することを決定しました。このライブラリは50以上のコンポーネントと200以上の API を持ち、移行には約3ヶ月を要しました。重要なリファクタリング戦略と陥った落とし穴を整理します。

## リファクタリング戦略：全量書き直しではなく段階的に

最初は全量書き換えを考えましたが、現実的ではないことが分かりました。私たちの戦略は3段階に分けることでした：

```
第一步：搭建 Vue 3 + Vite + TypeScript 构建环境
第二步：先迁移简单组件（Button、Tag、Icon），建立模式
第三步：按优先级逐步迁移复杂组件（Table、Form、Select）
```

核心原則：新しいコンポーネントは Vue 3 Composition API で書き、古いコンポーネントは使用可能にしつつ deprecated とマークします。

## 型定義体系

コンポーネントライブラリの型定義は最も時間がかかる部分ですが、最大の利益ももたらします：

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

コンポーネントでの使用例：

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

## スロット型推論

Vue 3.2+ の `defineSlots` により、スロットにも型が付けられるようになりました：

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

## ビルド設定

Vite Library Mode を使用してコンポーネントライブラリを構築：

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

## 移行の最大の落とし穴：v-model の変更

Vue 3 の `v-model` のセマンティクスは Vue 2 と異なり、これが移行中に最もコード修正が多い箇所でした：

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

私たちの解決策は、移行期間中に Vue 2 スタイルの props を自動検出する ESLint ルールを作成することでした。

## まとめ

- 段階的移行は全量書き換えよりも現実的であり、先に単純なコンポーネントを移行してパターンを確立する
- TypeScript の型定義体系はコンポーネントライブラリの重要な資産であり、時間をかける価値がある
- Vite Library Mode によりビルド設定が簡素化された
- `v-model` のセマンティクス変更が最大の breaking change であり、体系的な対応が必要
- Vue 3.2+ の `defineSlots` と `defineExpose` によりコンポーネント API がより完全になった