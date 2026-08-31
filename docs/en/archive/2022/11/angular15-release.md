---
title: "Angular 15 Release: Directive Composition API and NgOptimizedImage"
date: 2022-11-16 16:44:56
tags:
  - Angular
readingTime: 2
description: "Angular 15 was officially released on November 16, 2022. This release brings Standalone APIs to stable (no longer developer preview), along with two major new features: Directive Composition API and NgOptimizedImage."
wordCount: 187
---

Angular 15 was officially released on November 16, 2022. This release brings Standalone APIs to stable (no longer developer preview), along with two major new features: Directive Composition API and NgOptimizedImage.

## Standalone APIs Officially Stable

```typescript
// Angular 15：Standalone 相关 API 正式稳定，可以放心用于生产
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

This is the most important new feature in Angular 15. `hostDirectives` allows a component/directive to **embed** the behavior of other directives, achieving a mixin-like effect:

```typescript
// 先定义一些小的行为指令
@Directive({ selector: "[cdkDraggable]", standalone: true })
export class DraggableDirective {
  @HostListener("mousedown", ["$event"])
  onMouseDown(event: MouseEvent) {
    /* 拖拽逻辑 */
  }
}

@Directive({ selector: "[appTooltip]", standalone: true })
export class TooltipDirective {
  @Input("appTooltip") text = "";
  // 显示 tooltip 逻辑...
}

@Directive({ selector: "[appHighlight]", standalone: true })
export class HighlightDirective {
  @Input("appHighlightColor") color = "yellow";
  // 高亮逻辑...
}

// Angular 15：使用 hostDirectives 组合这些行为
@Component({
  selector: "app-draggable-card",
  standalone: true,
  template: `<div class="card"><ng-content></ng-content></div>`,
  hostDirectives: [
    DraggableDirective,
    {
      directive: TooltipDirective,
      inputs: ["appTooltip: tooltip"], // 重新映射 input 名称
    },
    {
      directive: HighlightDirective,
      inputs: ["appHighlightColor: highlightColor"],
    },
  ],
})
export class DraggableCardComponent {}
```

Usage:

```html
<!-- hostDirectives 的 inputs 暴露在组件上 -->
<app-draggable-card tooltip="拖动我" highlightColor="lightblue">
  卡片内容
</app-draggable-card>
```

## NgOptimizedImage: Built-in Image Optimization

```typescript
import { NgOptimizedImage } from "@angular/common";

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <!-- 使用 ngSrc 替代 src，Angular 自动优化 -->
    <img ngSrc="hero.jpg" width="800" height="600" priority />
    <!-- priority: 关键图片（LCP），自动添加 preload link -->

    <!-- 响应式图片 -->
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

**What NgOptimizedImage does**:

- Automatically generates `srcset` and `sizes`
- Adds `<link rel="preload">` for `priority` images
- Prevents layout shift (CLS): enforces setting `width` and `height`
- Lazy-loads non-critical images (automatically adds `loading="lazy"`)
- Supports CDN loaders (Imgix, Cloudinary, Cloudflare Images)

## Better Error Stack Traces

Angular 15 significantly improved error messages, especially for template errors:

```
# Angular 14 的错误栈（难以定位）
ERROR Error: Cannot read property 'name' of undefined
    at Object.updateTextNode (core.mjs:12345)
    at executeActionOnView (core.mjs:23456)

# Angular 15 的错误栈（清晰指向组件和模板）
ERROR Error: Cannot read property 'name' of undefined
    in UserCardComponent (user-card.component.ts:15)
    accessing 'user.name' in template
```

## Removing Deprecated APIs

Angular 15 cleaned up a batch of long-deprecated APIs:

```typescript
// ❌ 已移除：ComponentFactoryResolver（Angular 13 废弃）
// ❌ 已移除：DATE_PIPE_DEFAULT_TIMEZONE（使用 DATE_PIPE_DEFAULT_OPTIONS）
// ❌ 已移除：Hammerjs 手势支持（需要手动添加）

// ✅ 替代方案
// ComponentFactoryResolver → ViewContainerRef.createComponent(Component)
```

## Upgrading to Angular 15

```bash
ng update @angular/core@15 @angular/cli@15 @angular/material@15

# 自动迁移：
# 1. 移除已废弃的 ComponentFactoryResolver 注入
# 2. 更新 RouterModule 到 provideRouter（如使用 standalone）
# 3. 迁移 DatePipe 配置
```

## Summary

Angular 15's core contributions are: the Directive Composition API fills in the long-missing directive reuse capability, NgOptimizedImage makes image optimization a one-click operation, and Standalone APIs going stable officially marks the arrival of the "NgModule-free" era. For the Angular team, the two releases in 2022 (14 and 15) have revitalized the framework.