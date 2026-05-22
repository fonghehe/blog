---
title: "從零搭建 Vue 組件庫的第一步：落地路徑與實戰建議"
date: 2018-05-31 17:00:05
tags:
  - 組件化
  - 工程化
readingTime: 1
description: "公司項目越來越多，經常要把同一套 UI 組件複製來複製去。終於決定把通用組件提取成內部組件庫。記錄一下搭建過程的第一步。"
wordCount: 181
---

公司項目越來越多，經常要把同一套 UI 組件複製來複製去。終於決定把通用組件提取成內部組件庫。記錄一下搭建過程的第一步。

## 為什麼要自建組件庫

```
現狀：
  - 三個項目用的都是類似的 Button、Table、Form 組件
  - 設計稿統一，但代碼各自實現，樣式有出入
  - 一個組件改了 Bug，要改三個地方

目標：
  - 統一 UI 風格
  - 減少重複工作
  - 組件有版本，升級可追蹤
```

## 項目結構

```
my-ui/
├── packages/
│   ├── button/
│   │   ├── src/
│   │   │   └── Button.vue
│   │   └── index.js      ← 導出這個組件
│   ├── input/
│   └── table/
├── src/
│   └── index.js          ← 整體導出入口
├── examples/             ← 文檔和示例
├── tests/
├── package.json
└── webpack.config.js     ← 打包配置
```

## 組件的基本結構

```vue
<!-- packages/button/src/Button.vue -->
<template>
  <button
    :class="[
      'ui-button',
      `ui-button--${type}`,
      `ui-button--${size}`,
      { 'is-loading': loading, 'is-disabled': disabled },
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <i v-if="loading" class="ui-icon-loading"></i>
    <slot></slot>
  </button>
</template>

<script>
export default {
  name: "UiButton",
  props: {
    type: {
      type: String,
      default: "default",
      validator: (val) =>
        ["default", "primary", "danger", "text"].includes(val),
    },
    size: {
      type: String,
      default: "medium",
      validator: (val) => ["large", "medium", "small"].includes(val),
    },
    loading: Boolean,
    disabled: Boolean,
  },
  methods: {
    handleClick(e) {
      if (!this.disabled && !this.loading) {
        this.$emit("click", e);
      }
    },
  },
};
</script>
```

## 組件的導出

```javascript
// packages/button/index.js
import Button from './src/Button.vue'
Button.install = function(Vue) {
  Vue.component(Button.name, Button)
}
export default Button

// src/index.js（整體入口）
import Button from '../packages/button'
import Input from '../packages/input'

const components = [Button, Input]

const install = function(Vue) {
  components.forEach(component => {
    Vue.component(component.name, component)
  })
}

// 支持全量導入
export default { install, version: '1.0.0' }

// 也支援按需導入
export { Button, Input }
```

## 使用方式

```javascript
// 全量導入
import UiLib from "my-ui";
import "my-ui/dist/my-ui.css";
Vue.use(UiLib);

// 按需導入（更推薦，減少打包體積）
import { Button } from "my-ui";
Vue.use(Button);
```

## 打包設定（Webpack）

```javascript
// webpack.lib.js
module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "my-ui.js",
    library: "MyUI",
    libraryTarget: "umd", // 支持 CommonJS、AMD、全局變量
  },
  externals: {
    vue: {
      root: "Vue",
      commonjs: "vue",
      commonjs2: "vue",
    },
  },
};
```

`externals` 很重要：vue 不打進去，讓使用方自己提供。

## 下一步

目前隻是搭了架子，接下來要做：

```
- 完善更多組件（Input、Select、Table、Modal）
- 寫文檔（考慮用 VuePress）
- 寫單元測試
- 發佈到公司 npm 私庫
- 設定 babel-plugin-import 支援按需引入
```

## 小結

- 組件庫核心：統一 install 方法，支持 `Vue.use()` 全量註冊
- 同時提供具名導出，支援按需引入
- Webpack `libraryTarget: 'umd'`：支持多種模塊系統
- `externals` 排除 Vue，避免打入多份