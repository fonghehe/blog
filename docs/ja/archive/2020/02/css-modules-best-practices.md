---
title: "VueプロジェクトにおけるCSS Modulesのベストプラクティス"
date: 2020-02-13 10:38:48
tags:
  - CSS
readingTime: 2
description: "多人协作的大项目，CSS 全局污染是个老大难问题。对比了 Scoped CSS、CSS Modules 和 CSS-in-JS 后，最终在组件库项目中选择了 CSS Modules，记录一下实践方案。"
---

多人协作的大项目，CSS 全局污染是个老大难问题。对比了 Scoped CSS、CSS Modules 和 CSS-in-JS 后，最终在组件库项目中选择了 CSS Modules，记录一下实践方案。

## Scoped CSS vs CSS Modules

```vue
<!-- Scoped CSS：通过属性选择器实现 -->
<template>
  <div class="button">Click</div>
</template>

<style scoped>
.button { color: red; }
</style>

<!-- 编译后 -->
<div class="button" data-v-f3f3eg9>Click</div>
<!-- 选择器变成 .button[data-v-f3f3eg9] -->
```

Scoped CSS 的问题：
- 属性选择器性能比类选择器差（虽然差距很小）
- 子组件根元素会同时有 scoped 和非 scoped 样式
- 深度选择器（`/deep/`、`::v-deep`）容易被滥用

## CSS Modulesの基本設定

```vue
<template>
  <!-- 使用 $style 对象 -->
  <div :class="$style.container">
    <button :class="[$style.btn, $style.primary]">
      提交
    </button>
  </div>
</template>

<style module>
.container {
  max-width: 1200px;
  margin: 0 auto;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.primary {
  background: #409eff;
  color: #fff;
}
</style>
```

编译后类名变成哈希值，天然无冲突：`container_x7f2a`、`btn_k9m3z`。

## コンポーネントライブラリでの使い方

```vue
<template>
  <div :class="[ns.b(), ns.is('disabled', disabled)]">
    <span :class="ns.e('icon')">
      <slot name="icon" />
    </span>
    <span :class="ns.e('label')">
      <slot />
    </span>
  </div>
</template>

<script>
// 用 BEM 命名空间生成类名
function useNamespace(block) {
  const ns = {
    b: () => `el-${block}`,                    // el-button
    e: (element) => `el-${block}__${element}`,  // el-button__icon
    m: (modifier) => `el-${block}--${modifier}`,// el-button--primary
    is: (state, value) => value ? `is-${state}` : '', // is-disabled
  };
  return { ns };
}

export default {
  name: 'ElButton',
  props: {
    disabled: Boolean,
    type: { type: String, default: 'default' },
  },
  setup(props) {
    const { ns } = useNamespace('button');
    return { ns };
  },
};
</script>

<style module>
.el-button {
  display: inline-flex;
  align-items: center;
  padding: 12px 20px;
  font-size: 14px;
  border-radius: 4px;
  transition: all 0.3s;
}

.el-button__icon {
  margin-right: 6px;
}

.el-button--primary {
  background-color: #409eff;
  color: #fff;
}

.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

## 动态类名

```vue
<template>
  <div :class="classes">
    <slot />
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  props: {
    size: {
      type: String,
      default: 'medium',
      validator: (v) => ['small', 'medium', 'large'].includes(v),
    },
    bordered: Boolean,
  },
  setup(props, { attrs }) {
    const classes = computed(() => [
      attrs.class,
      // 动态映射类名
      {
        [`size-${props.size}`]: true,
        'is-bordered': props.bordered,
      },
    ]);

    return { classes };
  },
};
</script>
```

## 全局样式变量

```javascript
// vue.config.js
module.exports = {
  css: {
    loaderOptions: {
      css: {
        modules: {
          // 自定义生成的类名格式
          localIdentName: process.env.NODE_ENV === 'development'
            ? '[name]__[local]--[hash:base64:5]'
            : '[hash:base64:8]',
        },
      },
    },
  },
};
```

```scss
// styles/variables.module.scss
:export {
  primaryColor: #409eff;
  successColor: #67c23a;
  warningColor: #e6a23c;
  dangerColor: #f56c6c;
  fontSizeBase: 14px;
  borderRadius: 4px;
}

// JS 中导入使用
// import variables from '@/styles/variables.module.scss';
// console.log(variables.primaryColor); // #409eff
```

## まとめ

- CSS Modules 通过哈希类名彻底解决全局污染问题
- 在 Vue 中通过 `$style` 对象访问，模板中绑定 `:class`
- 组件库项目推荐 BEM 命名 + CSS Modules 结合
- 开发环境保留可读类名，生产环境用短哈希
- CSS-in-JS 方案在 Vue 生态不如 CSS Modules 自然
