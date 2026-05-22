---
title: "Angular 15 リリース：Directive Composition API と NgOptimizedImage"
date: 2022-11-16 16:44:56
tags:
  - Angular
readingTime: 3
description: "Angular 15 は2022年11月16日に正式リリースされました。このバージョンでは Standalone APIs が安定状態（developer preview ではなくなり）、同時に Directive Composition API と NgOptimizedImage という2つの重要な新機能がもたらされました。"
wordCount: 423
---

Angular 15は2022年11月16日に正式リリースされました。このバージョンではStandalone APIsが安定状態になり（developer previewではなくなり）、同時にDirective Composition APIとNgOptimizedImageという2つの重要な新機能がもたらされました。

## Standalone APIs 正式安定化

```typescript
// Angular 15：Standalone 関連APIが正式に安定版になり、本番環境で安心して使用可能
// bootstrapApplication、provideRouter、provideHttpClient などすべて stable

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

これはAngular 15で最も重要な新機能です。`hostDirectives` により、コンポーネント/ディレクティブが他のディレクティブの振る舞いを**内包**でき、mixinのような効果を実現します：

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

使用例：

```html
<!-- hostDirectives の inputs がコンポーネントに公開される -->
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
    <!-- ngSrc を src の代わりに使用すると、Angular が自動最適化 -->
    <img ngSrc="hero.jpg" width="800" height="600" priority />
    <!-- priority: 重要な画像（LCP）、preload linkを自動追加 -->

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

**NgOptimizedImage の機能**：

- 自动生成 `srcset` 和 `sizes`
- 对 `priority` 图片添加 `<link rel="preload">`
- 防止布局偏移（CLS）：强制要求设置 `width` 和 `height`
- 懒加载非关键图片（自动添加 `loading="lazy"`）
- 支持 CDN loader（Imgix、Cloudinary、Cloudflare Images）

## 更好的错误栈信息

Angular 15ではエラー情報が大幅に改善されました。特にテンプレート内のエラーがわかりやすくなりました：

```
# Angular 14 のエラースタック（特定が困難）
ERROR Error: Cannot read property 'name' of undefined
    at Object.updateTextNode (core.mjs:12345)
    at executeActionOnView (core.mjs:23456)

# Angular 15 のエラースタック（コンポーネントとテンプレートを明確に指し示す）
ERROR Error: Cannot read property 'name' of undefined
    in UserCardComponent (user-card.component.ts:15)
    accessing 'user.name' in template
```

## 非推奨 API の削除

Angular 15 清理了一批长期废弃的 API：

```typescript
// ❌ 削除済み：ComponentFactoryResolver（Angular 13で非推奨）
// ❌ 削除済み：DATE_PIPE_DEFAULT_TIMEZONE（DATE_PIPE_DEFAULT_OPTIONSを使用）
// ❌ 削除済み：Hammerjs ジェスチャーサポート（手動で追加が必要）

// ✅ 代替方法
// ComponentFactoryResolver → ViewContainerRef.createComponent(Component)
```

## Angular 15 へのアップグレード

```bash
ng update @angular/core@15 @angular/cli@15 @angular/material@15

# 自動移行：
# 1. 非推奨の ComponentFactoryResolver 注入を削除
# 2. RouterModule を provideRouter に更新（standalone使用時）
# 3. DatePipe 設定を移行
```

## まとめ

Angular 15の中心的な貢献は次のとおりです：Directive Composition APIは長らく欠けていたディレクティブ再利用の機能を補い、NgOptimizedImageは画像最適化をワンクリック操作にし、Standalone APIsの正式安定化は「NgModule不要」の時代の到来を告げています。Angularチームにとって、2022年の2つのバージョン（14、15）はフレームワークに新たな活力をもたらしました。