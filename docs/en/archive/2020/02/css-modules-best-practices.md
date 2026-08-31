---
title: "CSS Modules Best Practices in Vue Projects"
date: 2020-02-13 10:38:48
tags:
  - CSS
readingTime: 2
description: "In large multi-contributor projects, global CSS pollution is a persistent headache. After comparing Scoped CSS, CSS Modules, and CSS-in-JS, I chose CSS Modules for our component library and document the approach here."
wordCount: 167
---

In large projects with many contributors, global CSS pollution is a long-standing headache. After comparing Scoped CSS, CSS Modules, and CSS-in-JS, I ended up going with CSS Modules for our component library and want to document the approach here.

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

The problems with Scoped CSS:
- Attribute selectors are slightly slower than class selectors (though the gap is tiny)
- A child component's root element can receive both scoped and non-scoped styles
- Deep selectors (`/deep/`, `::v-deep`) are easy to misuse

## CSS Modules Basic Configuration

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

After compilation, class names become hashed values, which are collision-free by design: `container_x7f2a`, `btn_k9m3z`.

## Usage in Component Libraries

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

## Dynamic Class Names

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

## Global Style Variables

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

## Summary

- CSS Modules eliminate global pollution entirely through hashed class names
- In Vue, access them via the `$style` object and bind with `:class` in templates
- For component libraries, combine BEM naming with CSS Modules
- Keep readable class names in development and use short hashes in production
- CSS-in-JS feels less natural than CSS Modules within the Vue ecosystem
