---
title: "Sass/SCSS エンジニアリング実践"
date: 2018-03-24 11:00:06
tags:
  - CSS
readingTime: 3
description: "SCSS は中大規模プロジェクトではほぼ標準となっていますが、多くのプロジェクトでは SCSS を「変数が使える CSS」として扱うだけで、そのエンジニアリング力を十分に活かせていません。"
---

SCSS は中大規模プロジェクトではほぼ標準となっていますが、多くのプロジェクトでは SCSS を「変数が使える CSS」として扱うだけで、そのエンジニアリング力を十分に活かせていません。

## ディレクトリ構成：7-1 パターン

```
styles/
├── abstracts/       抽象レイヤー（CSS を生成しない）
│   ├── _variables.scss   変数定義
│   ├── _mixins.scss      Mixin コレクション
│   └── _functions.scss   関数コレクション
├── base/            ベーススタイル
│   ├── _reset.scss       CSS リセット
│   └── _typography.scss  タイポグラフィ
├── components/      コンポーネントスタイル
│   ├── _button.scss
│   └── _card.scss
├── layout/          レイアウト
│   ├── _header.scss
│   └── _sidebar.scss
├── pages/           ページ固有スタイル
│   └── _dashboard.scss
├── themes/          テーマ
│   └── _dark.scss
└── main.scss        エントリーポイント、全ファイルを @import
```

## 変数規約

```scss
// abstracts/_variables.scss

// カラーシステム
$color-primary: #409eff;
$color-success: #67c23a;
$color-warning: #e6a23c;
$color-danger: #f56c6c;
$color-info: #909399;

// グレースケール
$color-text-primary: #303133;
$color-text-regular: #606266;
$color-text-secondary: #909399;
$color-text-placeholder: #c0c4cc;

$color-border: #dcdfe6;
$color-background: #f5f7fa;

// スペーシング（4px 基準）
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

// フォント
$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-md: 16px;
$font-size-lg: 18px;

// 角丸
$border-radius-sm: 2px;
$border-radius: 4px;
$border-radius-lg: 8px;

// シャドウ
$box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
$box-shadow-dark: 0 2px 4px rgba(0, 0, 0, 0.12);

// レスポンシブブレークポイント
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 992px;
$breakpoint-xl: 1200px;
```

## 実用的な Mixin コレクション

```scss
// abstracts/_mixins.scss

// クリアフィックス
@mixin clearfix {
  &::after {
    content: "";
    display: table;
    clear: both;
  }
}

// 1行テキスト省略
@mixin text-truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// 複数行テキスト省略
@mixin text-clamp($lines: 2) {
  display: -webkit-box;
  -webkit-line-clamp: $lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// フレックス中央揃え
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

// レスポンシブメディアクエリ
@mixin respond-to($breakpoint) {
  @if $breakpoint == "sm" {
    @media (max-width: $breakpoint-sm) {
      @content;
    }
  } @else if $breakpoint == "md" {
    @media (max-width: $breakpoint-md) {
      @content;
    }
  } @else if $breakpoint == "lg" {
    @media (max-width: $breakpoint-lg) {
      @content;
    }
  }
}

// 絶対位置中央揃え
@mixin absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

## 使用例

```scss
// components/_card.scss
@import "../abstracts/variables";
@import "../abstracts/mixins";

.card {
  background: #fff;
  border-radius: $border-radius;
  box-shadow: $box-shadow;
  padding: $spacing-md;

  &__title {
    font-size: $font-size-md;
    color: $color-text-primary;
    @include text-truncate;
    margin-bottom: $spacing-sm;
  }

  &__content {
    color: $color-text-regular;
    font-size: $font-size-base;
    @include text-clamp(3);
  }

  &--featured {
    border-left: 3px solid $color-primary;
  }

  @include respond-to("md") {
    padding: $spacing-sm;
  }
}
```

## Vue プロジェクトでの変数グローバル注入

`.vue` ファイルごとに手動で `@import` するのは面倒です。`sass-resources-loader` で自動注入できます：

```bash
npm install sass-resources-loader
```

```javascript
// vue.config.js または webpack.config.js
module.exports = {
  chainWebpack: (config) => {
    const types = ["vue-modules", "vue", "normal-modules", "normal"];
    types.forEach((type) => {
      config.module
        .rule("scss")
        .oneOf(type)
        .use("sass-resources-loader")
        .loader("sass-resources-loader")
        .options({
          resources: [
            "src/styles/abstracts/_variables.scss",
            "src/styles/abstracts/_mixins.scss",
          ],
        })
        .end();
    });
  },
};
```

これにより `.vue` ファイル内で変数や mixin を明示的なインポートなしに直接使用できます。

## よくある問題の回避

**1. ネストを深くしすぎない**

```scss
// ❌ ネストが深すぎる — 優先度が高くなり上書きしにくい
.sidebar {
  .nav {
    .nav-item {
      .link {
        .icon {
          color: red;
        }
      }
    }
  }
}

// ✅ 最大 3 層、BEM 命名と組み合わせる
.sidebar-nav__item-icon {
  color: red;
}
```

**2. @extend は慎重に**

`@extend` はセレクターをマージするため、予期せぬ CSS が生成される可能性があります：

```scss
// @extend より mixin を優先する
// @extend はモジュール化した場面で副作用がある
```

## まとめ

- 7-1 パターンで SCSS ファイルを整理し、責務を明確にする
- カラー・スペーシング・フォントなどのデザイントークンを変数ファイルに抽出する
- よく使う CSS パターンを mixin にして再利用性を高める
- `sass-resources-loader` を設定して変数を自動注入し、繰り返しのインポートを省く
