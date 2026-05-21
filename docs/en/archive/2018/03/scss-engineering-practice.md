---
title: "Sass/SCSS Engineering Practice"
date: 2018-03-24 11:00:06
tags:
  - CSS
readingTime: 2
description: "SCSS is now standard in most medium-to-large projects, but many teams only use it as \"CSS with variables,\" without leveraging its full engineering capabilities."
wordCount: 134
---

SCSS is now standard in most medium-to-large projects, but many teams only use it as "CSS with variables," without leveraging its full engineering capabilities.

## Directory Organization: The 7-1 Pattern

```
styles/
├── abstracts/       Abstract layer (generates no CSS)
│   ├── _variables.scss   Variable definitions
│   ├── _mixins.scss      Mixin collection
│   └── _functions.scss   Function collection
├── base/            Base styles
│   ├── _reset.scss       CSS reset
│   └── _typography.scss  Typography
├── components/      Component styles
│   ├── _button.scss
│   └── _card.scss
├── layout/          Layout
│   ├── _header.scss
│   └── _sidebar.scss
├── pages/           Page-specific styles
│   └── _dashboard.scss
├── themes/          Themes
│   └── _dark.scss
└── main.scss        Entry point, @import all files
```

## Variable Standards

```scss
// abstracts/_variables.scss

// Color system
$color-primary: #409eff;
$color-success: #67c23a;
$color-warning: #e6a23c;
$color-danger: #f56c6c;
$color-info: #909399;

// Grayscale
$color-text-primary: #303133;
$color-text-regular: #606266;
$color-text-secondary: #909399;
$color-text-placeholder: #c0c4cc;

$color-border: #dcdfe6;
$color-background: #f5f7fa;

// Spacing (based on 4px baseline)
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

// Typography
$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-md: 16px;
$font-size-lg: 18px;

// Border radius
$border-radius-sm: 2px;
$border-radius: 4px;
$border-radius-lg: 8px;

// Shadows
$box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
$box-shadow-dark: 0 2px 4px rgba(0, 0, 0, 0.12);

// Responsive breakpoints
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 992px;
$breakpoint-xl: 1200px;
```

## Useful Mixin Collection

```scss
// abstracts/_mixins.scss

// Clearfix
@mixin clearfix {
  &::after {
    content: "";
    display: table;
    clear: both;
  }
}

// Single-line text truncation
@mixin text-truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// Multi-line text truncation
@mixin text-clamp($lines: 2) {
  display: -webkit-box;
  -webkit-line-clamp: $lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// Flex center
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

// Responsive media query
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

// Absolute center
@mixin absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

## Usage Example

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

## Auto-inject Variables in Vue Projects

Manually `@import`-ing variable files in every `.vue` file is tedious. Use `sass-resources-loader` to inject them automatically:

```bash
npm install sass-resources-loader
```

```javascript
// vue.config.js or webpack.config.js
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

With this setup, you can use variables and mixins directly in `.vue` files without explicit imports.

## Avoiding Common Pitfalls

**1. Avoid deep nesting**

```scss
// ❌ Too deeply nested — high specificity, hard to override
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

// ✅ Max 3 levels, combined with BEM naming
.sidebar-nav__item-icon {
  color: red;
}
```

**2. Be cautious with @extend**

`@extend` merges selectors and can produce unexpected CSS:

```scss
// Prefer mixins over @extend
// @extend has side effects in modular scenarios
```

## Summary

- Use the 7-1 pattern to organize SCSS files with clear responsibilities
- Extract design tokens like colors, spacing, and typography into a variables file
- Encapsulate common CSS patterns as mixins for reuse
- Configure `sass-resources-loader` to auto-inject variables and avoid repeated imports
