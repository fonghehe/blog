---
title: "CSS Modules 在 Vue 專案中的最佳實踐"
date: 2020-02-13 10:38:48
tags:
  - CSS
readingTime: 2
description: "多人協作的大專案，CSS 全域性汙染是個老大難問題。對比了 Scoped CSS、CSS Modules 和 CSS-in-JS 後，最終在元件庫專案中選擇了 CSS Modules，記錄一下實踐方案。"
wordCount: 237
---

多人協作的大專案，CSS 全域性汙染是個老大難問題。對比了 Scoped CSS、CSS Modules 和 CSS-in-JS 後，最終在元件庫專案中選擇了 CSS Modules，記錄一下實踐方案。

## Scoped CSS vs CSS Modules

```vue
<!-- Scoped CSS：通過屬性選擇器實現 -->
<template>
  <div class="button">Click</div>
</template>

<style scoped>
.button { color: red; }
</style>

<!-- 編譯後 -->
<div class="button" data-v-f3f3eg9>Click</div>
<!-- 選擇器變成 .button[data-v-f3f3eg9] -->
```

Scoped CSS 的問題：
- 屬性選擇器效能比類選擇器差（雖然差距很小）
- 子元件根元素會同時有 scoped 和非 scoped 樣式
- 深度選擇器（`/deep/`、`::v-deep`）容易被濫用

## CSS Modules 基礎設定

```vue
<template>
  <!-- 使用 $style 物件 -->
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

編譯後類名變成雜湊值，天然無衝突：`container_x7f2a`、`btn_k9m3z`。

## 元件庫中的用法

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
// 用 BEM 名稱空間生成類名
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

## 動態類名

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
      // 動態對映類名
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

## 全域性樣式變數

```javascript
// vue.config.js
module.exports = {
  css: {
    loaderOptions: {
      css: {
        modules: {
          // 自定義生成的類名格式
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

// JS 中匯入使用
// import variables from '@/styles/variables.module.scss';
// console.log(variables.primaryColor); // #409eff
```

## 小結

- CSS Modules 通過雜湊類名徹底解決全域性汙染問題
- 在 Vue 中通過 `$style` 物件訪問，模板中繫結 `:class`
- 元件庫專案推薦 BEM 命名 + CSS Modules 結合
- 開發環境保留可讀類名，生產環境用短雜湊
- CSS-in-JS 方案在 Vue 生態不如 CSS Modules 自然
