---
title: "Angular 19 RC 前瞻：增量水合与模板热更新"
date: 2024-10-23 10:00:00
tags:
  - Angular
---

Angular 19 RC 已经可以预览，正式版预计 2024 年 11 月 19 日发布。本文基于 RC 版本介绍最重要的新特性——**增量水合（Incremental Hydration）**和**模板 HMR**，以及路由级渲染模式的进一步完善。

> 本文基于 Angular 19 RC，API 可能与正式版有细微差异。

## 增量水合（Incremental Hydration）

Angular 17 引入了非破坏性 SSR 水合，但仍是全量水合——页面所有组件同时激活。Angular 19 引入了**增量水合**：组件可以按需、延迟地完成水合，类似 `@defer` 块的懒加载逻辑。

```typescript
// app.config.ts：开启增量水合（需要同时开启 SSR + 非破坏性水合）
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(
      withIncrementalHydration(), // 开启增量水合
    ),
  ],
};
```

在模板中使用 `@defer` 控制水合时机：

```html
<!-- 服务端渲染，但客户端仅在可见时才水合 -->
@defer (hydrate on viewport) {
<heavy-analytics-chart [data]="chartData" />
}

<!-- 用户交互时才水合 -->
@defer (hydrate on interaction) {
<rich-text-editor [(content)]="body" />
}

<!-- 立即水合（默认行为）-->
@defer (hydrate immediately) {
<critical-header />
}

<!-- 永不水合（纯静态内容）-->
@defer (hydrate never) {
<static-footer />
}
```

增量水合的好处：

- 服务端输出完整 HTML（SEO 友好）
- 客户端只水合用户可见/交互的部分
- 首次交互时间（TTI）大幅缩短
- 对于内容密集型页面（新闻、博客）效果最明显

## 模板 HMR（Hot Module Replacement）

Angular 19 正式支持组件**模板**的热更新——修改 `.html` 模板文件后，无需刷新整个页面，只更新对应组件的视图，保留应用状态：

```bash
ng serve
# 修改 app.component.html → 仅更新 AppComponent 的视图，状态保留
# 修改 product-card.component.html → 仅更新所有 ProductCard 实例
# 修改 .ts 文件 → 仍然全页刷新（组件逻辑变更，状态重置）
```

这对表单密集型应用特别有价值——开发中反复调整表单布局时，不再因 HMR 导致已填写的数据丢失。

## 路由级渲染模式（稳定化）

Angular 18 引入、19 进一步稳定的路由级渲染模式：

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  {
    path: "", // 首页：预渲染（构建时生成静态 HTML）
    renderMode: RenderMode.Prerender,
  },
  {
    path: "blog/:slug", // 博客文章：预渲染（需要提供所有可能的 slug）
    renderMode: RenderMode.Prerender,
  },
  {
    path: "dashboard", // 仪表盘：服务端渲染（每次请求动态生成）
    renderMode: RenderMode.Server,
  },
  {
    path: "profile", // 个人主页：纯客户端渲染
    renderMode: RenderMode.Client,
  },
  {
    path: "**", // 其余路由：SSR 兜底
    renderMode: RenderMode.Server,
  },
];
```

## linkedSignal 正式稳定（预期）

Angular 18.2 引入的实验性 `linkedSignal()` 预计在 19 中稳定：

```typescript
// Angular 19 中 linkedSignal 预计去掉实验标记
import { linkedSignal } from '@angular/core';

@Component({ standalone: true, ... })
export class TabsComponent {
  tabs = input.required<Tab[]>();

  // 当 tabs 变化时自动重置到第一个 tab，但用户切换后本地状态有效
  activeTab = linkedSignal(() => this.tabs()[0]);
}
```

## Zoneless 变更检测：从实验到推荐

Angular 19 中 Zoneless 模式从"实验性"提升为"开发者预览"：

```typescript
// Angular 18：provideExperimentalZonelessChangeDetection()（实验性）
// Angular 19：provideZonelessChangeDetection()（开发者预览，去掉 Experimental）
import { provideZonelessChangeDetection } from "@angular/core";

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
});
```

## 总结

Angular 19 的增量水合是 SSR 性能的重大提升，结合 `@defer` 语法，开发者可以精细控制哪些内容需要立即激活、哪些延迟激活。模板 HMR 则是对开发体验的直接改善。如果你在关注 Angular 的 SSR 能力，Angular 19 值得认真评估。正式版 11 月 19 日发布，RC 阶段可以开始在测试环境中验证。
