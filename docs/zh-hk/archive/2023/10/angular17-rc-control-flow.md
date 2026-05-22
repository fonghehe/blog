---
title: "Angular 17 RC 預覽：新控製流與 Deferrable Views 改變範本寫法"
date: 2023-10-25 10:22:36
tags:
  - Angular
readingTime: 2
description: "Angular 17 Release Candidate 於 2023 年 10 月 4 日發佈，正式版預計 11 月 8 日發佈。RC 階段的 API 已經穩定，可以在非生產環境中提前體驗。兩個最重磅的特性——**內置控製流**和 **Deferrable Views**——徹底改變了 Angular 範本的寫法。"
wordCount: 380
---

Angular 17 Release Candidate 於 2023 年 10 月 4 日發佈，正式版預計 11 月 8 日發佈。RC 階段的 API 已經穩定，可以在非生產環境中提前體驗。兩個最重磅的特性——**內置控製流**和 **Deferrable Views**——徹底改變了 Angular 範本的寫法。

> **注意**：本文基於 Angular 17 RC，正式版 API 可能有細微差異。

## 內置控製流：@if / @for / @switch

Angular 的結構指令（`*ngIf`、`*ngFor`）是歷史遺留設計，需要 `CommonModule` 或單獨導入，語法也不直觀。Angular 17 引入了語言級別的控製流語法：

```html
<!-- 舊方式：需要導入 NgIf、NgFor、NgSwitch -->
<div *ngIf="user; else loading">{{ user.name }}</div>
<ng-template #loading><p>Loading...</p></ng-template>

<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>

<!-- Angular 17 新控製流：內置語言特性，無需導入 -->
@if (user) {
<div>{{ user.name }}</div>
} @else if (user === null) {
<p>用户不存在</p>
} @else {
<p>Loading...</p>
} @for (item of items; track item.id) {
<li>{{ item.name }}</li>
} @empty {
<li>暫無數據</li>
} @switch (status) { @case ('loading') { <spinner /> } @case ('error') {
<error-message /> } @default { <content /> } }
```

### @for 的 track 是必須的

Angular 17 的 `@for` **強製要求** `track` 表達式（而 `*ngFor` 的 `trackBy` 是可選的），這是一個重要改進：

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

<!-- 對於無 id 的基本類型數組 -->
@for (name of names; track $index) {
<span>{{ name }}</span>
}
```

## Deferrable Views：@defer

這是 Angular 17 最激動人心的特性。`@defer` 讓組件/範本塊可以**懶加載**——不隻是懶加載路由，而是細粒度到範本中任意一塊內容：

```html
<!-- 簡單的 @defer：組件代碼按需懶加載 -->
@defer {
<heavy-chart-component [data]="chartData" />
} @placeholder {
<div class="chart-skeleton">圖表加載中...</div>
} @loading {
<spinner />
} @error {
<p>圖表加載失敗</p>
}
```

### @defer 觸發條件

```html
<!-- 默認：空閒時懶加載（requestIdleCallback） -->
@defer {
<comments-section />
}

<!-- 視口內可見時加載（IntersectionObserver） -->
@defer (on viewport) {
<below-fold-content />
}

<!-- 鼠標懸停時加載 -->
@defer (on hover) {
<tooltip-content />
}

<!-- 用户交互時加載 -->
@defer (on interaction) {
<rich-text-editor />
}

<!-- 定時加載 -->
@defer (on timer(3000)) {
<late-content />
}

<!-- 條件加載 -->
@defer (when isAdmin()) {
<admin-panel />
}

<!-- 預加載：滿足條件時預取，但不立即渲染 -->
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

## 新的默認構建系統：esbuild

Angular 17 將 esbuild（通過 `@angular-devkit/build-angular:application`）設為默認構建器：

```
構建速度對比（中型項目，50個組件）：
舊構建器（webpack）：首次構建 ~45s，熱更新 ~3s
新構建器（esbuild）：首次構建 ~12s，熱更新 ~400ms
```

```json
// angular.json（Angular 17 新項目默認）
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

Angular 17 是近年來對範本語法改動最大的版本。新控製流語法更直觀，強製 `track` 減少了列表渲染的效能陷阱；`@defer` 是前端懶加載的新範式——從"路由懶加載"升級到"內容塊懶加載"。正式版預計 11 月 8 日發佈，RC 階段可以開始在項目中測試遷移。