---
title: "Sass/SCSS 工程化實踐"
date: 2018-03-24 11:00:06
tags:
  - CSS
readingTime: 2
description: "SCSS 現在幾乎是中大型專案的標配，但很多專案只是把 SCSS 當作有變數的 CSS 來用，沒有充分利用它的工程化能力。"
wordCount: 230
---

SCSS 現在幾乎是中大型專案的標配，但很多專案只是把 SCSS 當作有變數的 CSS 來用，沒有充分利用它的工程化能力。

## 目錄組織：7-1 模式

```
styles/
├── abstracts/       抽象層（不生成 CSS）
│   ├── _variables.scss   變數定義
│   ├── _mixins.scss      Mixin 集合
│   └── _functions.scss   函式集合
├── base/            基礎樣式
│   ├── _reset.scss       CSS 重置
│   └── _typography.scss  字型排版
├── components/      元件樣式
│   ├── _button.scss
│   └── _card.scss
├── layout/          佈局
│   ├── _header.scss
│   └── _sidebar.scss
├── pages/           頁面特定樣式
│   └── _dashboard.scss
├── themes/          主題
│   └── _dark.scss
└── main.scss        入口，@import 所有檔案
```

## 變數規範

```scss
// abstracts/_variables.scss

// 顏色系統
$color-primary: #409eff;
$color-success: #67c23a;
$color-warning: #e6a23c;
$color-danger: #f56c6c;
$color-info: #909399;

// 灰度
$color-text-primary: #303133;
$color-text-regular: #606266;
$color-text-secondary: #909399;
$color-text-placeholder: #c0c4cc;

$color-border: #dcdfe6;
$color-background: #f5f7fa;

// 間距（基於 4px 基準）
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

// 字型
$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-md: 16px;
$font-size-lg: 18px;

// 圓角
$border-radius-sm: 2px;
$border-radius: 4px;
$border-radius-lg: 8px;

// 陰影
$box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
$box-shadow-dark: 0 2px 4px rgba(0, 0, 0, 0.12);

// 響應式斷點
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 992px;
$breakpoint-xl: 1200px;
```

## Mixin 實用集合

```scss
// abstracts/_mixins.scss

// 清除浮動
@mixin clearfix {
  &::after {
    content: "";
    display: table;
    clear: both;
  }
}

// 文本截斷
@mixin text-truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// 多行文本截斷
@mixin text-clamp($lines: 2) {
  display: -webkit-box;
  -webkit-line-clamp: $lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// flex 居中
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

// 響應式媒體查詢
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

// 絕對定位居中
@mixin absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

## 使用示例

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

## 在 Vue 專案中全域性引入變數

每個 `.vue` 檔案都手動 `@import` 變數檔案很繁瑣，可以通過 `sass-resources-loader` 自動注入：

```bash
npm install sass-resources-loader
```

```javascript
// vue.config.js 或 webpack.config.js
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

這樣在 `.vue` 檔案裡可以直接使用變數和 mixin，不需要顯式匯入。

## 避免常見問題

**1. 避免巢狀過深**

```scss
// ❌ 巢狀太深，CSS 選擇器優先順序過高，難以覆蓋
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

// ✅ 最多 3 層，配合 BEM 命名
.sidebar-nav__item-icon {
  color: red;
}
```

**2. 慎用 @extend**

`@extend` 會合並選擇器，可能生成意想不到的 CSS：

```scss
// 優先用 mixin 而不是 @extend
// @extend 在模組化場景下有副作用
```

## 小結

- 用 7-1 模式組織 SCSS 檔案，職責清晰
- 把顏色、間距、字型等設計 token 提取到變數檔案
- 常用 CSS 模式提取成 mixin，提高複用性
- 配置 `sass-resources-loader` 自動注入變數，避免重複匯入
