---
title: "Sass/SCSS 工程化实践"
date: 2018-03-24 11:00:06
tags:
  - CSS
---

SCSS 现在几乎是中大型项目的标配，但很多项目只是把 SCSS 当作有变量的 CSS 来用，没有充分利用它的工程化能力。

## 目录组织：7-1 模式

```
styles/
├── abstracts/       抽象层（不生成 CSS）
│   ├── _variables.scss   变量定义
│   ├── _mixins.scss      Mixin 集合
│   └── _functions.scss   函数集合
├── base/            基础样式
│   ├── _reset.scss       CSS 重置
│   └── _typography.scss  字体排版
├── components/      组件样式
│   ├── _button.scss
│   └── _card.scss
├── layout/          布局
│   ├── _header.scss
│   └── _sidebar.scss
├── pages/           页面特定样式
│   └── _dashboard.scss
├── themes/          主题
│   └── _dark.scss
└── main.scss        入口，@import 所有文件
```

## 变量规范

```scss
// abstracts/_variables.scss

// 颜色系统
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

// 间距（基于 4px 基准）
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

// 字体
$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-md: 16px;
$font-size-lg: 18px;

// 圆角
$border-radius-sm: 2px;
$border-radius: 4px;
$border-radius-lg: 8px;

// 阴影
$box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
$box-shadow-dark: 0 2px 4px rgba(0, 0, 0, 0.12);

// 响应式断点
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 992px;
$breakpoint-xl: 1200px;
```

## Mixin 实用集合

```scss
// abstracts/_mixins.scss

// 清除浮动
@mixin clearfix {
  &::after {
    content: "";
    display: table;
    clear: both;
  }
}

// 文本截断
@mixin text-truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// 多行文本截断
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

// 响应式媒体查询
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

// 绝对定位居中
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

## 在 Vue 项目中全局引入变量

每个 `.vue` 文件都手动 `@import` 变量文件很繁琐，可以通过 `sass-resources-loader` 自动注入：

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

这样在 `.vue` 文件里可以直接使用变量和 mixin，不需要显式导入。

## 避免常见问题

**1. 避免嵌套过深**

```scss
// ❌ 嵌套太深，CSS 选择器优先级过高，难以覆盖
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

// ✅ 最多 3 层，配合 BEM 命名
.sidebar-nav__item-icon {
  color: red;
}
```

**2. 慎用 @extend**

`@extend` 会合并选择器，可能生成意想不到的 CSS：

```scss
// 优先用 mixin 而不是 @extend
// @extend 在模块化场景下有副作用
```

## 小结

- 用 7-1 模式组织 SCSS 文件，职责清晰
- 把颜色、间距、字体等设计 token 提取到变量文件
- 常用 CSS 模式提取成 mixin，提高复用性
- 配置 `sass-resources-loader` 自动注入变量，避免重复导入
