---
title: "Angular 17 RC 預覽：新控製流與 Deferrable Views 改變範本寫法"
date: 2023-10-25 10:22:36
tags:
  - Angular
readingTime: 2
description: "Angular 17 Release Candidate 於 2023 年 10 月 4 日釋出，正式版預計 11 月 8 日釋出。RC 階段的 API 已經穩定，可以在非生產環境中提前體驗。兩個最重磅的特性——**內建控製流**和 **Deferrable Views**——徹底改變了 Angular 範本的寫法。"
wordCount: 380
---

Angular 17 Release Candidate 於 2023 年 10 月 4 日釋出，正式版預計 11 月 8 日釋出。RC 階段的 API 已經穩定，可以在非生產環境中提前體驗。兩個最重磅的特性——**內建控製流**和 **Deferrable Views**——徹底改變了 Angular 範本的寫法。

> **注意**：本文基於 Angular 17 RC，正式版 API 可能有細微差異。

## 內建控製流：@if / @for / @switch

Angular 的結構指令（`*ngIf`、`*ngFor`）是歷史遺留設計，需要 `CommonModule` 或單獨匯入，語法也不直觀。Angular 17 引入了語言級別的控製流語法：

```html
<!-- 舊方式：需要匯入 NgIf、NgFor、NgSwitch -->
<div *ngIf="user; else loading">{{ user.name }}</div>
<ng-template #loading><p>Loading...</p></ng-template>

<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>

<!-- Angular 17 新控製流：內建語言特性，無需匯入 -->
@if (user) {
<div>{{ user.name }}</div>
} @else if (user === null) {
<p>使用者不存在</p>
} @else {
<p>Loading...</p>
} @for (item of items; track item.id) {
<li>{{ item.name }}</li>
} @empty {
<li>暫無資料</li>
} @switch (status) { @case ('loading') { <spinner /> } @case ('error') {
<error-message /> } @default { <content /> } }
```

### @for 的 track 是必須的

Angular 17 的 `@for` **強製要求** `track` 表示式（而 `*ngFor` 的 `trackBy` 是可選的），這是一個重要改進：

```html
<!-- 錯誤：缺少 track -->
@for (item of items) {
<!-- 編譯報錯！ -->
<div>{{ item }}</div>
}

<!-- 正確 -->
@for (item of items; track item.id) {
<div>{{ item.name }}</div>
}

<!-- 對於無 id 的基本型別陣列 -->
@for (name of names; track $index) {
<span>{{ name }}</span>
}
```

## Deferrable Views：@defer

這是 Angular 17 最激動人心的特性。`@defer` 讓元件/範本塊可以**懶載入**——不隻是懶載入路由，而是細粒度到範本中任意一塊內容：

```html
<!-- 簡單的 @defer：元件程式碼按需懶載入 -->
@defer {
<heavy-chart-component [data]="chartData" />
} @placeholder {
<div class="chart-skeleton">圖表載入中...</div>
} @loading {
<spinner />
} @error {
<p>圖表載入失敗</p>
}
```

### @defer 觸發條件

```html
<!-- 預設：空閒時懶載入（requestIdleCallback） -->
@defer {
<comments-section />
}

<!-- 視口內可見時載入（IntersectionObserver） -->
@defer (on viewport) {
<below-fold-content />
}

<!-- 滑鼠懸停時載入 -->
@defer (on hover) {
<tooltip-content />
}

<!-- 使用者互動時載入 -->
@defer (on interaction) {
<rich-text-editor />
}

<!-- 定時載入 -->
@defer (on timer(3000)) {
<late-content />
}

<!-- 條件載入 -->
@defer (when isAdmin()) {
<admin-panel />
}

<!-- 預載入：滿足條件時預取，但不立即渲染 -->
@defer (on viewport; prefetch on idle) {
<expensive-widget />
}
```

## Signals 在 Angular 17 中趨於穩定

```typescript
// Angular 17：signal()、computed()、effect() 正式穩定（不再是 developer preview）
import { signal, computed, effect } from '@angular/core';

@Component({ standalone: true, ... })
export class ShoppingCartComponent {
  items = signal<CartItem[]>([]);

  total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.qty, 0)
  );

  itemCount = computed(() => this.items().length);
}
```

## 新的預設構建系統：esbuild

Angular 17 將 esbuild（通過 `@angular-devkit/build-angular:application`）設為預設構建器：

```
構建速度對比（中型專案，50個元件）：
舊構建器（webpack）：首次構建 ~45s，熱更新 ~3s
新構建器（esbuild）：首次構建 ~12s，熱更新 ~400ms
```

```json
// angular.json（Angular 17 新專案預設）
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application"
    }
  }
}
```

## 升級到 Angular 17

```bash
ng update @angular/core@17 @angular/cli@17

# 自動遷移（可選）：
# 將 *ngIf、*ngFor、*ngSwitch 轉換為新控製流語法
ng generate @angular/core:control-flow
```

## 總結

Angular 17 是近年來對範本語法改動最大的版本。新控製流語法更直觀，強製 `track` 減少了列表渲染的效能陷阱；`@defer` 是前端懶載入的新範式——從"路由懶載入"升級到"內容塊懶載入"。正式版預計 11 月 8 日釋出，RC 階段可以開始在專案中測試遷移。