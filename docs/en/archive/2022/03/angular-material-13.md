---
title: "Angular Material 13: Migration Guide for MDC-Based Components"
date: 2022-03-30 10:56:22
tags:
  - Angular
readingTime: 2
description: "Angular Material 13 随 Angular 13 一起发布，带来了基于 Material Design Components for Web（MDC）重新实现的组件。这次重构不只是样式调整——组件的 DOM 结构和 CSS 类名都发生了变化，因此迁移需要一定的关注。"
---

Angular Material 13 随 Angular 13 一起发布，带来了基于 Material Design Components for Web（MDC）重新实现的组件。这次重构不只是样式调整——组件的 DOM 结构和 CSS 类名都发生了变化，因此迁移需要一定的关注。

## 什么是 MDC-Based Components

Angular Material 原先的组件是自行实现的，与 Google 维护的 `material-components-web` 库是两套代码。Angular Material 13 开始，官方用 MDC 库重写所有组件，好处是：

- 与 Material Design 规范保持更紧密的同步
- 组件行为与其他平台（Android、iOS Web）一致
- 无障碍访问（A11y）改进

## 新旧组件共存

Angular Material 13 提供了**两套组件**并行，通过不同的模块导入：

```typescript
// 旧实现（Legacy）：mat-button 等继续可用
import { MatButtonModule } from "@angular/material/button"; // 仍是旧实现

// 新 MDC 实现：通过 mdc 子包引入
// Angular Material 13 的迁移策略：逐步替换
```

注意：Angular Material 13 的大多数组件默认已切换到 MDC 实现，但会提供 Legacy 模块作为兼容过渡期。

## 主要变化：Button

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

**CSS 自定义迁移**：

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

## 主题系统变化

Angular Material 13 引入了新的 M3-ready 主题 API 预备：

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

**Density**（密度）是 Angular Material 13 新概念，用于控制组件紧凑程度：

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

## Form Field 变化

Form Field 是变化最大的组件之一：

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

注意：`appearance="legacy"` 和 `appearance="standard"` 在 MDC 版本中被废弃，推荐使用 `fill` 或 `outline`。

## 迁移工具

Angular Material 提供了自动迁移 schematic：

```bash
ng update @angular/material@13

# 迁移会自动：
# 1. 更新导入路径
# 2. 更新废弃的 API 调用
# 3. 生成迁移报告
```

对于 CSS 自定义覆盖，需要手动检查并改用 CSS 变量：

```bash
# 检查项目中可能受影响的 CSS
grep -r "mat-button-wrapper\|mat-form-field-wrapper" src/
```

## Summary

Angular Material 13 的 MDC 迁移是一次"有痛苦但值得"的升级。如果项目有大量 CSS 自定义覆盖，需要逐个检查。但迁移之后，组件的 A11y 支持更完善，主题系统更灵活，与 Material Design 规范的对齐度也更高。建议在 13→14 升级前先完成 MDC 迁移，避免双重变更的复杂度。