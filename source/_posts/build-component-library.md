---
title: "从零搭建 Vue 组件库的第一步"
date: 2018-05-31 17:00:05
tags:
  - 组件化
---

公司项目越来越多，经常要把同一套 UI 组件复制来复制去。终于决定把通用组件提取成内部组件库。记录一下搭建过程的第一步。

## 为什么要自建组件库

```
现状：
  - 三个项目用的都是类似的 Button、Table、Form 组件
  - 设计稿统一，但代码各自实现，样式有出入
  - 一个组件改了 Bug，要改三个地方

目标：
  - 统一 UI 风格
  - 减少重复工作
  - 组件有版本，升级可追踪
```

## 项目结构

```
my-ui/
├── packages/
│   ├── button/
│   │   ├── src/
│   │   │   └── Button.vue
│   │   └── index.js      ← 导出这个组件
│   ├── input/
│   └── table/
├── src/
│   └── index.js          ← 整体导出入口
├── examples/             ← 文档和示例
├── tests/
├── package.json
└── webpack.config.js     ← 打包配置
```

## 组件的基本结构

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

## 组件的导出

```javascript
// packages/button/index.js
import Button from './src/Button.vue'
Button.install = function(Vue) {
  Vue.component(Button.name, Button)
}
export default Button

// src/index.js（整体入口）
import Button from '../packages/button'
import Input from '../packages/input'

const components = [Button, Input]

const install = function(Vue) {
  components.forEach(component => {
    Vue.component(component.name, component)
  })
}

// 支持全量导入
export default { install, version: '1.0.0' }

// 也支持按需导入
export { Button, Input }
```

## 使用方式

```javascript
// 全量导入
import UiLib from "my-ui";
import "my-ui/dist/my-ui.css";
Vue.use(UiLib);

// 按需导入（更推荐，减少打包体积）
import { Button } from "my-ui";
Vue.use(Button);
```

## 打包配置（Webpack）

```javascript
// webpack.lib.js
module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "my-ui.js",
    library: "MyUI",
    libraryTarget: "umd", // 支持 CommonJS、AMD、全局变量
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

`externals` 很重要：vue 不打进去，让使用方自己提供。

## 下一步

目前只是搭了架子，接下来要做：

```
- 完善更多组件（Input、Select、Table、Modal）
- 写文档（考虑用 VuePress）
- 写单元测试
- 发布到公司 npm 私库
- 配置 babel-plugin-import 支持按需引入
```

## 小结

- 组件库核心：统一 install 方法，支持 `Vue.use()` 全量注册
- 同时提供具名导出，支持按需引入
- Webpack `libraryTarget: 'umd'`：支持多种模块系统
- `externals` 排除 Vue，避免打入多份