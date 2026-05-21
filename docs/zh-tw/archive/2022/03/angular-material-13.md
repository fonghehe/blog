---
title: "Angular Material 13：MDC-Based Components 遷移指南"
date: 2022-03-30 10:56:22
tags:
  - Angular
readingTime: 2
description: "Angular Material 13 隨 Angular 13 一起釋出，帶來了基於 Material Design Components for Web（MDC）重新實現的元件。這次重構不只是樣式調整——元件的 DOM 結構和 CSS 類名都發生了變化，因此遷移需要一定的關注。"
wordCount: 447
---

Angular Material 13 隨 Angular 13 一起釋出，帶來了基於 Material Design Components for Web（MDC）重新實現的元件。這次重構不只是樣式調整——元件的 DOM 結構和 CSS 類名都發生了變化，因此遷移需要一定的關注。

## 什麼是 MDC-Based Components

Angular Material 原先的元件是自行實現的，與 Google 維護的 `material-components-web` 庫是兩套程式碼。Angular Material 13 開始，官方用 MDC 庫重寫所有元件，好處是：

- 與 Material Design 規範保持更緊密的同步
- 元件行為與其他平臺（Android、iOS Web）一致
- 無障礙訪問（A11y）改進

## 新舊元件共存

Angular Material 13 提供了**兩套元件**並行，通過不同的模組匯入：

```typescript
// 舊實現（Legacy）：mat-button 等繼續可用
import { MatButtonModule } from "@angular/material/button"; // 仍是舊實現

// 新 MDC 實現：通過 mdc 子包引入
// Angular Material 13 的遷移策略：逐步替換
```

注意：Angular Material 13 的大多陣列件預設已切換到 MDC 實現，但會提供 Legacy 模組作為相容過渡期。

## 主要變化：Button

```html
<!-- 舊版 DOM 結構 -->
<button mat-button class="mat-button mat-button-base">
  <span class="mat-button-wrapper">Click me</span>
  <div class="mat-button-ripple mat-ripple"></div>
</button>

<!-- MDC 版 DOM 結構（更扁平）-->
<button mat-button class="mat-mdc-button mdc-button">
  <span class="mdc-button__label">Click me</span>
  <span class="mat-mdc-button-ripple"></span>
</button>
```

**CSS 自定義遷移**：

```scss
// ❌ 舊的 CSS 覆蓋（不再有效）
.mat-button .mat-button-wrapper {
  padding: 0;
}

// ✅ 新的 CSS 變數方式
.mat-mdc-button {
  --mdc-text-button-label-text-color: #0066ff;
  --mdc-text-button-label-text-size: 14px;
}
```

## 主題系統變化

Angular Material 13 引入了新的 M3-ready 主題 API 預備：

```scss
// angular-theme.scss
@use "@angular/material" as mat;

// 定義調色盤
$primary-palette: mat.define-palette(mat.$indigo-palette);
$accent-palette: mat.define-palette(mat.$pink-palette, A200, A100, A400);

// 建立主題
$theme: mat.define-light-theme(
  (
    color: (
      primary: $primary-palette,
      accent: $accent-palette,
    ),
    typography: mat.define-typography-config(),
    density: 0,
    // Angular Material 13 新增 density 引數
  )
);

// 應用主題
@include mat.all-component-themes($theme);
```

**Density**（密度）是 Angular Material 13 新概念，用於控制組件緊湊程度：

```scss
// density: 0  → 標準大小（預設）
// density: -1 → 稍微緊湊
// density: -2 → 更緊湊（適合資料密集型 UI）
// density: -3 → 最緊湊
$compact-theme: mat.define-light-theme(
  (
    color: (
      ...,
    ),
    density: -2,
  )
);
```

## Form Field 變化

Form Field 是變化最大的元件之一：

```html
<!-- 使用 appearance="fill"（MDC 預設） -->
<mat-form-field appearance="fill">
  <mat-label>使用者名稱</mat-label>
  <input matInput type="text" [(ngModel)]="username" />
  <mat-error>使用者名稱不能為空</mat-error>
  <mat-hint>請輸入 6-20 位字元</mat-hint>
</mat-form-field>

<!-- outline 風格 -->
<mat-form-field appearance="outline">
  <mat-label>密碼</mat-label>
  <input matInput type="password" />
  <mat-icon matSuffix>visibility</mat-icon>
</mat-form-field>
```

注意：`appearance="legacy"` 和 `appearance="standard"` 在 MDC 版本中被廢棄，推薦使用 `fill` 或 `outline`。

## 遷移工具

Angular Material 提供了自動遷移 schematic：

```bash
ng update @angular/material@13

# 遷移會自動：
# 1. 更新匯入路徑
# 2. 更新廢棄的 API 呼叫
# 3. 生成遷移報告
```

對於 CSS 自定義覆蓋，需要手動檢查並改用 CSS 變數：

```bash
# 檢查專案中可能受影響的 CSS
grep -r "mat-button-wrapper\|mat-form-field-wrapper" src/
```

## 總結

Angular Material 13 的 MDC 遷移是一次"有痛苦但值得"的升級。如果專案有大量 CSS 自定義覆蓋，需要逐個檢查。但遷移之後，元件的 A11y 支援更完善，主題系統更靈活，與 Material Design 規範的對齊度也更高。建議在 13→14 升級前先完成 MDC 遷移，避免雙重變更的複雜度。