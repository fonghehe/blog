---
title: "First Steps to Building a Vue Component Library from Scratch"
date: 2018-05-31 17:00:05
tags:
  - Engineering
readingTime: 2
description: "With more and more company projects, we kept copying the same UI components everywhere. We finally decided to extract the common components into an internal lib"
wordCount: 112
---

With more and more company projects, we kept copying the same UI components everywhere. We finally decided to extract the common components into an internal library. Here's a record of the first steps.

## Why Build Your Own Component Library

```
Current situation:
  - Three projects all use similar Button, Table, Form components
  - Designs are consistent, but implementations diverge and styles drift
  - Fix a bug in one component → fix it in three places

Goal:
  - Unified UI style
  - Less duplicated work
  - Versioned components with trackable upgrades
```

## Project Structure

```
my-ui/
├── packages/
│   ├── button/
│   │   ├── src/
│   │   │   └── Button.vue
│   │   └── index.js      ← exports this component
│   ├── input/
│   └── table/
├── src/
│   └── index.js          ← overall entry point
├── examples/             ← docs and examples
├── tests/
├── package.json
└── webpack.config.js     ← bundle config
```

## Basic Component Structure

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

## Exporting Components

```javascript
// packages/button/index.js
import Button from './src/Button.vue'
Button.install = function(Vue) {
  Vue.component(Button.name, Button)
}
export default Button

// src/index.js (main entry point)
import Button from '../packages/button'
import Input from '../packages/input'

const components = [Button, Input]

const install = function(Vue) {
  components.forEach(component => {
    Vue.component(component.name, component)
  })
}

// Supports full import
export default { install, version: '1.0.0' }

// Also supports tree-shakeable import
export { Button, Input }
```

## Usage

```javascript
// Full import
import UiLib from "my-ui";
import "my-ui/dist/my-ui.css";
Vue.use(UiLib);

// On-demand import (recommended — smaller bundle)
import { Button } from "my-ui";
Vue.use(Button);
```

## Bundle Config (Webpack)

```javascript
// webpack.lib.js
module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "my-ui.js",
    library: "MyUI",
    libraryTarget: "umd", // supports CommonJS, AMD, and global variables
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

`externals` is critical: Vue is not bundled in — consumers provide their own copy.

## Next Steps

The scaffolding is in place. What comes next:

```
- Add more components (Input, Select, Table, Modal)
- Write documentation (considering VuePress)
- Write unit tests
- Publish to the company's private npm registry
- Configure babel-plugin-import for on-demand imports
```

## Summary

- Core of a component library: a unified `install` method that supports `Vue.use()` for full registration
- Also provide named exports for on-demand imports
- Webpack `libraryTarget: 'umd'`: supports multiple module systems
- `externals` excludes Vue to avoid bundling multiple copies
