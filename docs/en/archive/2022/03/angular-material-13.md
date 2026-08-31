---
title: "Angular Material 13: Migration Guide for MDC-Based Components"
date: 2022-03-30 10:56:22
tags:
  - Angular
readingTime: 2
description: "Angular Material 13 shipped alongside Angular 13, bringing components reimplemented on top of Material Design Components for Web (MDC). This refactor is more than a style refresh — the DOM structure and CSS class names have changed, so migration requires some attention."
wordCount: 296
---

Angular Material 13 shipped alongside Angular 13, bringing components reimplemented on top of Material Design Components for Web (MDC). This refactor is more than a style refresh — the DOM structure and CSS class names have changed, so migration requires some attention.

## What Are MDC-Based Components

Angular Material's original components were implemented independently from Google's `material-components-web` library. Starting with Angular Material 13, the team rewrote all components using the MDC library. The benefits are:

- Stays more closely in sync with the Material Design spec
- Component behavior is consistent across platforms (Android, iOS Web)
- Improved accessibility (A11y)

## Legacy and New Components Coexist

Angular Material 13 provides **two sets of components** side by side, imported through different modules:

```typescript
// 旧实现（Legacy）：mat-button 等继续可用
import { MatButtonModule } from "@angular/material/button"; // 仍是旧实现

// 新 MDC 实现：通过 mdc 子包引入
// Angular Material 13 的迁移策略：逐步替换
```

Note: Most components in Angular Material 13 have switched to the MDC implementation by default, but Legacy modules are provided as a compatibility bridge.

## Key Changes: Button

```html
<!-- 旧版 DOM 结构 -->
<button mat-button class="mat-button mat-button-base">
  <span class="mat-button-wrapper">Click me</span>
  <div class="mat-button-ripple mat-ripple"></div>
</button>

<!-- MDC 版 DOM 结构（更扁平）-->
<button mat-button class="mat-mdc-button mdc-button">
  <span class="mdc-button__label">Click me</span>
  <span class="mat-mdc-button-ripple"></span>
</button>
```

**CSS customization migration**:

```scss
// ❌ 旧的 CSS 覆盖（不再有效）
.mat-button .mat-button-wrapper {
  padding: 0;
}

// ✅ 新的 CSS 变量方式
.mat-mdc-button {
  --mdc-text-button-label-text-color: #0066ff;
  --mdc-text-button-label-text-size: 14px;
}
```

## Theming System Changes

Angular Material 13 introduces a new M3-ready theming API:

```scss
// angular-theme.scss
@use "@angular/material" as mat;

// 定义调色板
$primary-palette: mat.define-palette(mat.$indigo-palette);
$accent-palette: mat.define-palette(mat.$pink-palette, A200, A100, A400);

// 创建主题
$theme: mat.define-light-theme(
  (
    color: (
      primary: $primary-palette,
      accent: $accent-palette,
    ),
    typography: mat.define-typography-config(),
    density: 0,
    // Angular Material 13 新增 density 参数
  )
);

// 应用主题
@include mat.all-component-themes($theme);
```

**Density** is a new concept in Angular Material 13 that controls how compact components are:

```scss
// density: 0  → 标准大小（默认）
// density: -1 → 稍微紧凑
// density: -2 → 更紧凑（适合数据密集型 UI）
// density: -3 → 最紧凑
$compact-theme: mat.define-light-theme(
  (
    color: (
      ...,
    ),
    density: -2,
  )
);
```

## Form Field Changes

Form Field is one of the most changed components:

```html
<!-- 使用 appearance="fill"（MDC 默认） -->
<mat-form-field appearance="fill">
  <mat-label>用户名</mat-label>
  <input matInput type="text" [(ngModel)]="username" />
  <mat-error>用户名不能为空</mat-error>
  <mat-hint>请输入 6-20 位字符</mat-hint>
</mat-form-field>

<!-- outline 风格 -->
<mat-form-field appearance="outline">
  <mat-label>密码</mat-label>
  <input matInput type="password" />
  <mat-icon matSuffix>visibility</mat-icon>
</mat-form-field>
```

Note: `appearance="legacy"` and `appearance="standard"` are deprecated in the MDC version; use `fill` or `outline` instead.

## Migration Tools

Angular Material provides an automatic migration schematic:

```bash
ng update @angular/material@13

# 迁移会自动：
# 1. 更新导入路径
# 2. 更新废弃的 API 调用
# 3. 生成迁移报告
```

For custom CSS overrides, you need to manually review them and switch to CSS variables:

```bash
# 检查项目中可能受影响的 CSS
grep -r "mat-button-wrapper\|mat-form-field-wrapper" src/
```

## Summary

The MDC migration in Angular Material 13 is a "painful but worthwhile" upgrade. If your project has lots of custom CSS overrides, you'll need to review them one by one. But after migrating, components have better A11y support, a more flexible theming system, and closer alignment with the Material Design spec. It's best to complete the MDC migration before upgrading from 13 to 14, to avoid the complexity of double changes.