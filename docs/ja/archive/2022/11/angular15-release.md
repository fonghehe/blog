---
title: "Angular 15 リリース：Directive Composition API と NgOptimizedImage"
date: 2022-11-16 16:44:56
tags:
  - Angular
readingTime: 2
description: "Angular 15 于 2022 年 11 月 16 日正式发布。这个版本让 Standalone APIs 进入稳定状态（不再是 developer preview），同时带来了两个重量级新特性：Directive Composition API 和 NgOptimizedImage。"
wordCount: 313
---

Angular 15 于 2022 年 11 月 16 日正式发布。这个版本让 Standalone APIs 进入稳定状态（不再是 developer preview），同时带来了两个重量级新特性：Directive Composition API 和 NgOptimizedImage。

## Standalone APIs 正式安定化

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

这是 Angular 15 最重要的新特性。`hostDirectives` 允许一个组件/指令**内嵌**其他指令的行为，实现类似 mixin 的效果：

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

使用时：

```html
<!-- hostDirectives 的 inputs 暴露在组件上 -->
<app-draggable-card tooltip="拖动我" highlightColor="lightblue">
  卡片内容
</app-draggable-card>
```

## NgOptimizedImage：組み込み画像最適化

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

**NgOptimizedImage 做了什么**：

- 自动生成 `srcset` 和 `sizes`
- 对 `priority` 图片添加 `<link rel="preload">`
- 防止布局偏移（CLS）：强制要求设置 `width` 和 `height`
- 懒加载非关键图片（自动添加 `loading="lazy"`）
- 支持 CDN loader（Imgix、Cloudinary、Cloudflare Images）

## 更好的错误栈信息

Angular 15 大幅改善了错误信息，特别是模板中的错误：

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

## 非推奨 API の削除

Angular 15 清理了一批长期废弃的 API：

```typescript
// ❌ 已移除：ComponentFactoryResolver（Angular 13 废弃）
// ❌ 已移除：DATE_PIPE_DEFAULT_TIMEZONE（使用 DATE_PIPE_DEFAULT_OPTIONS）
// ❌ 已移除：Hammerjs 手势支持（需要手动添加）

// ✅ 替代方案
// ComponentFactoryResolver → ViewContainerRef.createComponent(Component)
```

## Angular 15 へのアップグレード

```bash
ng update @angular/core@15 @angular/cli@15 @angular/material@15

# 自动迁移：
# 1. 移除已废弃的 ComponentFactoryResolver 注入
# 2. 更新 RouterModule 到 provideRouter（如使用 standalone）
# 3. 迁移 DatePipe 配置
```

## まとめ

Angular 15 的核心贡献是：Directive Composition API 填补了长期缺失的指令复用能力，NgOptimizedImage 让图片优化变成一键式操作，Standalone APIs 正式稳定则标志着"无 NgModule"时代正式到来。对 Angular 团队来说，2022 年的两个版本（14、15）让框架重新焕发了活力。