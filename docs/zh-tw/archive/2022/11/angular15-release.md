---
title: "Angular 15 釋出：Directive Composition API 與 NgOptimizedImage"
date: 2022-11-16 16:44:56
tags:
  - Angular
readingTime: 2
description: "Angular 15 於 2022 年 11 月 16 日正式釋出。這個版本讓 Standalone APIs 進入穩定狀態（不再是 developer preview），同時帶來了兩個重量級新特性：Directive Composition API 和 NgOptimizedImage。"
wordCount: 303
---

Angular 15 於 2022 年 11 月 16 日正式釋出。這個版本讓 Standalone APIs 進入穩定狀態（不再是 developer preview），同時帶來了兩個重量級新特性：Directive Composition API 和 NgOptimizedImage。

## Standalone APIs 正式穩定

```typescript
// Angular 15：Standalone 相關 API 正式穩定，可以放心用於生產
// bootstrapApplication、provideRouter、provideHttpClient 等全部 stable

import { bootstrapApplication } from "@angular/platform-browser";
import {
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({ scrollPositionRestoration: "enabled" }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
});
```

## Directive Composition API

這是 Angular 15 最重要的新特性。`hostDirectives` 允許一個元件/指令**內嵌**其他指令的行為，實現類似 mixin 的效果：

```typescript
// 先定義一些小的行為指令
@Directive({ selector: "[cdkDraggable]", standalone: true })
export class DraggableDirective {
  @HostListener("mousedown", ["$event"])
  onMouseDown(event: MouseEvent) {
    /* 拖拽邏輯 */
  }
}

@Directive({ selector: "[appTooltip]", standalone: true })
export class TooltipDirective {
  @Input("appTooltip") text = "";
  // 顯示 tooltip 邏輯...
}

@Directive({ selector: "[appHighlight]", standalone: true })
export class HighlightDirective {
  @Input("appHighlightColor") color = "yellow";
  // 高亮邏輯...
}

// Angular 15：使用 hostDirectives 組合這些行為
@Component({
  selector: "app-draggable-card",
  standalone: true,
  template: `<div class="card"><ng-content></ng-content></div>`,
  hostDirectives: [
    DraggableDirective,
    {
      directive: TooltipDirective,
      inputs: ["appTooltip: tooltip"], // 重新對映 input 名稱
    },
    {
      directive: HighlightDirective,
      inputs: ["appHighlightColor: highlightColor"],
    },
  ],
})
export class DraggableCardComponent {}
```

使用時：

```html
<!-- hostDirectives 的 inputs 暴露在元件上 -->
<app-draggable-card tooltip="拖動我" highlightColor="lightblue">
  卡片內容
</app-draggable-card>
```

## NgOptimizedImage：內建圖片最佳化

```typescript
import { NgOptimizedImage } from "@angular/common";

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <!-- 使用 ngSrc 替代 src，Angular 自動最佳化 -->
    <img ngSrc="hero.jpg" width="800" height="600" priority />
    <!-- priority: 關鍵圖片（LCP），自動新增 preload link -->

    <!-- 響應式圖片 -->
    <img
      ngSrc="product.jpg"
      width="400"
      height="300"
      ngSrcset="400w, 800w, 1200w"
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  `,
})
export class HeroComponent {}
```

**NgOptimizedImage 做了什麼**：

- 自動生成 `srcset` 和 `sizes`
- 對 `priority` 圖片新增 `<link rel="preload">`
- 防止佈局偏移（CLS）：強製要求設定 `width` 和 `height`
- 懶載入非關鍵圖片（自動新增 `loading="lazy"`）
- 支援 CDN loader（Imgix、Cloudinary、Cloudflare Images）

## 更好的錯誤棧資訊

Angular 15 大幅改善了錯誤資訊，特別是模板中的錯誤：

```
# Angular 14 的錯誤棧（難以定位）
ERROR Error: Cannot read property 'name' of undefined
    at Object.updateTextNode (core.mjs:12345)
    at executeActionOnView (core.mjs:23456)

# Angular 15 的錯誤棧（清晰指向元件和範本）
ERROR Error: Cannot read property 'name' of undefined
    in UserCardComponent (user-card.component.ts:15)
    accessing 'user.name' in template
```

## 移除廢棄的 API

Angular 15 清理了一批長期廢棄的 API：

```typescript
// ❌ 已移除：ComponentFactoryResolver（Angular 13 廢棄）
// ❌ 已移除：DATE_PIPE_DEFAULT_TIMEZONE（使用 DATE_PIPE_DEFAULT_OPTIONS）
// ❌ 已移除：Hammerjs 手勢支援（需要手動新增）

// ✅ 替代方案
// ComponentFactoryResolver → ViewContainerRef.createComponent(Component)
```

## 升級到 Angular 15

```bash
ng update @angular/core@15 @angular/cli@15 @angular/material@15

# 自動遷移：
# 1. 移除已廢棄的 ComponentFactoryResolver 注入
# 2. 更新 RouterModule 到 provideRouter（如使用 standalone）
# 3. 遷移 DatePipe 設定
```

## 總結

Angular 15 的核心貢獻是：Directive Composition API 填補了長期缺失的指令複用能力，NgOptimizedImage 讓圖片最佳化變成一鍵式操作，Standalone APIs 正式穩定則標誌著"無 NgModule"時代正式到來。對 Angular 團隊來說，2022 年的兩個版本（14、15）讓框架重新煥發了活力。