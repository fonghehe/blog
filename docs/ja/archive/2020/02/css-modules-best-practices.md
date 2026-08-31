---
title: "VueプロジェクトにおけるCSS Modulesのベストプラクティス"
date: 2020-02-13 10:38:48
tags:
  - CSS
readingTime: 2
description: "複数人で協業する大規模プロジェクトでは、CSS のグローバル汚染が長年の課題だ。Scoped CSS、CSS Modules、CSS-in-JS を比較した結果、コンポーネントライブラリプロジェクトでは CSS Modules を採用し、その実践内容を記録する。"
wordCount: 431
---

多人で協業する大規模プロジェクトでは、CSS のグローバル汚染が長年の悩みの種だ。Scoped CSS、CSS Modules、CSS-in-JS を比較した上で、最終的にコンポーネントライブラリのプロジェクトでは CSS Modules を選び、その実践内容を記録しておく。

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

Scoped CSS の問題点：
- 属性セレクターはクラスセレクターよりパフォーマンスが劣る（差は小さいが）
- 子コンポーネントのルート要素には scoped と非 scoped の両方のスタイルが当たる
- 深度セレクター（`/deep/`、`::v-deep`）は乱用されやすい

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

コンパイル後はクラス名がハッシュ値に変わり、衝突はそもそも起きない：`container_x7f2a`、`btn_k9m3z`。

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

## 動的クラス名

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

## グローバルスタイル変数

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

- CSS Modules はハッシュ化されたクラス名により、グローバル汚染問題を根本的に解決する
- Vue では `$style` オブジェクトを通じてアクセスし、テンプレートでは `:class` でバインドする
- コンポーネントライブラリプロジェクトでは BEM 命名 + CSS Modules の組み合わせを推奨する
- 開発環境では可読性のあるクラス名を残し、本番環境では短いハッシュを使う
- CSS-in-JS は Vue エコシステムでは CSS Modules ほど自然に馴染まない
