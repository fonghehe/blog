---
title: "Vueコンポーネントライブラリをゼロから構築する第一歩"
date: 2018-05-31 17:00:05
tags:
  - エンジニアリング
readingTime: 2
description: "会社のプロジェクトが増えるにつれて、同じUIコンポーネントをコピー&ペーストし続けることになりました。ついに共通コンポーネントを内部コンポーネントライブラリとして切り出すことにしました。構築プロセスの第一歩を記録します。"
---

会社のプロジェクトが増えるにつれて、同じUIコンポーネントをコピー&ペーストし続けることになりました。ついに共通コンポーネントを内部コンポーネントライブラリとして切り出すことにしました。構築プロセスの第一歩を記録します。

## なぜ自前のコンポーネントライブラリを作るのか

```
現状：
  - 3つのプロジェクトが同様のButton・Table・Formコンポーネントを使用
  - デザインは統一されているが、実装がバラバラでスタイルにズレがある
  - 1つのコンポーネントのバグを直す → 3か所で修正が必要

目標：
  - UIスタイルの統一
  - 重複作業の削減
  - バージョン管理されたコンポーネントで更新履歴が追跡可能
```

## プロジェクト構成

```
my-ui/
├── packages/
│   ├── button/
│   │   ├── src/
│   │   │   └── Button.vue
│   │   └── index.js      ← このコンポーネントをエクスポート
│   ├── input/
│   └── table/
├── src/
│   └── index.js          ← 全体のエントリーポイント
├── examples/             ← ドキュメントとサンプル
├── tests/
├── package.json
└── webpack.config.js     ← バンドル設定
```

## コンポーネントの基本構造

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

## コンポーネントのエクスポート

```javascript
// packages/button/index.js
import Button from './src/Button.vue'
Button.install = function(Vue) {
  Vue.component(Button.name, Button)
}
export default Button

// src/index.js（全体エントリーポイント）
import Button from '../packages/button'
import Input from '../packages/input'

const components = [Button, Input]

const install = function(Vue) {
  components.forEach(component => {
    Vue.component(component.name, component)
  })
}

// 全量インポートをサポート
export default { install, version: '1.0.0' }

// オンデマンドインポートもサポート
export { Button, Input }
```

## 使用方法

```javascript
// 全量インポート
import UiLib from "my-ui";
import "my-ui/dist/my-ui.css";
Vue.use(UiLib);

// オンデマンドインポート（推奨 — バンドルサイズを削減）
import { Button } from "my-ui";
Vue.use(Button);
```

## バンドル設定（Webpack）

```javascript
// webpack.lib.js
module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "my-ui.js",
    library: "MyUI",
    libraryTarget: "umd", // CommonJS・AMD・グローバル変数をサポート
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

`externals`は重要：Vueをバンドルに含めず、利用側が自分で提供します。

## 次のステップ

骨格ができました。次にやること：

```
- より多くのコンポーネントを追加（Input・Select・Table・Modal）
- ドキュメントを書く（VuePressを検討中）
- ユニットテストを書く
- 社内のprivate npmレジストリに公開
- babel-plugin-importを設定してオンデマンドインポートをサポート
```

## まとめ

- コンポーネントライブラリのコア：統一された`install`メソッドで`Vue.use()`による全量登録をサポート
- 名前付きエクスポートも提供してオンデマンドインポートをサポート
- Webpackの`libraryTarget: 'umd'`：複数のモジュールシステムをサポート
- `externals`でVueを除外し、複数コピーのバンドルを防ぐ
