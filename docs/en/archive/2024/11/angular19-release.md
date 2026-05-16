---
title: "Angular 19 Official Release: Incremental Hydration, Route-Level Rendering, and Zoneless Developer Preview"
date: 2024-11-20 10:00:00
tags:
  - Angular
  - CSS
readingTime: 2
description: "Angular 19 officially launched on November 19, 2024. This is one of the most significant Angular releases in recent years for SSR capabilities and the reactive "
---

Angular 19 officially launched on November 19, 2024. This is one of the most significant Angular releases in recent years for SSR capabilities and the reactive model. Key highlights: Incremental Hydration is officially available, route-level rendering modes are stable, Zoneless has been promoted to developer preview, and template HMR is officially supported.

## Incremental Hydration: A New Level of SSR Performance

Full hydration activates all components on page load, even those the user can't see or doesn't need. Incremental hydration allows each `@defer` block to independently control when to hydrate:

```typescript
// 1. 开启增量水合
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

```html
<!-- 2. 在模板中声明水合策略 -->
<!-- 进入视口时水合（低优先级内容推荐） -->
@defer (hydrate on viewport) {
<comments-section />
}

<!-- 用户交互时水合（富交互组件） -->
@defer (hydrate on interaction) {
<rich-text-editor [(content)]="articleBody" />
}

<!-- 立即水合（关键内容） -->
@defer (hydrate immediately) {
<product-hero [product]="featured" />
}

<!-- 永不水合：服务端渲染后作为静态 HTML 保留 -->
@defer (hydrate never) {
<legal-footer />
}
```

**Performance Comparison (Typical Content Page, 40 Components)**:

```
全量水合（Angular 17/18）：
  服务端 HTML → 全部 40 个组件同时激活
  TTI: ~1.8s, TBT: ~320ms

增量水合（Angular 19）：
  服务端 HTML → 仅激活视口内 6 个组件
  其余组件在用户滚动/交互时按需激活
  TTI: ~0.6s, TBT: ~80ms
```

## Route-Level Rendering Modes (Officially Stable)

每条路由可以独立选择 SSR、预渲染或 CSR：

```typescript
// app.routes.server.ts（Angular 19 稳定 API）
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  { path: "", renderMode: RenderMode.Prerender },
  { path: "products", renderMode: RenderMode.Prerender },
  { path: "products/:id", renderMode: RenderMode.Server }, // 动态 SSR
  { path: "checkout", renderMode: RenderMode.Client }, // 纯 CSR（无需 SEO）
  { path: "**", renderMode: RenderMode.Server },
];
```

## Zoneless: From Experimental to Developer Preview

```typescript
// Angular 18：provideExperimentalZonelessChangeDetection()
// Angular 19：API 更名，去掉 Experimental
import { provideZonelessChangeDetection } from "@angular/core";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // 开发者预览，可用于生产评估
  ],
});
```

Also remove `zone.js` from `polyfills` in `angular.json`, reducing bundle size by approximately 33KB.

## Template HMR (Hot Module Replacement)

```bash
ng serve
# 修改 .component.html → 仅更新对应组件的视图，应用状态保留
# 修改 .component.css  → 样式即时注入，无刷新
# 修改 .component.ts   → 全量刷新（逻辑变更需重置状态）
```

This is most valuable for form-heavy applications: when adjusting form layouts, you no longer lose already-entered content due to HMR.

## linkedSignal() Stable

```typescript
import { linkedSignal, input, Component } from '@angular/core';

@Component({ standalone: true, ... })
export class ListWithSelectionComponent {
  items = input.required<Item[]>();

  // 当 items 变化时重置选中项；用户可以手动修改选中项
  selectedItem = linkedSignal(() => this.items()[0] ?? null);
}
```

## Signal-based Components: OnPush Will Become Default

Angular 19 发布了 RFC，计划在未来版本将 `OnPush` 作为新项目的默认变更检测策略（配合 Signals 使用）。现在可以在新组件中主动采用：

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // 现在推荐明确声明
  template: `{{ user().name }}`,
})
export class UserComponent {
  user = input.required<User>();
}
```

## Upgrading to Angular 19

```bash
ng update @angular/core@19 @angular/cli@19

# 查看自动迁移选项
ng update @angular/core@19 --from=18 --dry-run
```

## Summary

Angular 19 takes an important step in the SSR direction: incremental hydration solves the performance overhead of full activation, and route-level rendering modes enable more fine-grained architectural decisions. Zoneless developer preview marks Angular's formal entry into a stable "zone.js-free" phase. If your Angular application has SSR requirements, Angular 19 is a version worth seriously planning to upgrade to.
