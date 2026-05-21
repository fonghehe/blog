---
title: "Angular 19 RC 前瞻：增量水合與模板熱更新"
date: 2024-10-23 10:00:00
tags:
  - Angular
readingTime: 3
description: "Angular 19 RC 已經可以預覽，正式版預計 2024 年 11 月 19 日發佈。本文基於 RC 版本介紹最重要的新特性——**增量水合（Incremental Hydration）**和**模板 HMR**，以及路由級渲染模式的進一步完善。"
wordCount: 524
---

Angular 19 RC 已經可以預覽，正式版預計 2024 年 11 月 19 日發佈。本文基於 RC 版本介紹最重要的新特性——**增量水合（Incremental Hydration）**和**模板 HMR**，以及路由級渲染模式的進一步完善。

> 本文基於 Angular 19 RC，API 可能與正式版有細微差異。

## 增量水合（Incremental Hydration）

Angular 17 引入了非破壞性 SSR 水合，但仍是全量水合——頁面所有組件同時激活。Angular 19 引入了**增量水合**：組件可以按需、延遲地完成水合，類似 `@defer` 塊的懶加載邏輯。

```typescript
// app.config.ts：開啓增量水合（需要同時開啓 SSR + 非破壞性水合）
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(
      withIncrementalHydration(), // 開啓增量水合
    ),
  ],
};
```

在模板中使用 `@defer` 控制水合時機：

```html
<!-- 服務端渲染，但客户端僅在可見時才水合 -->
@defer (hydrate on viewport) {
<heavy-analytics-chart [data]="chartData" />
}

<!-- 用户交互時才水合 -->
@defer (hydrate on interaction) {
<rich-text-editor [(content)]="body" />
}

<!-- 立即水合（默認行為）-->
@defer (hydrate immediately) {
<critical-header />
}

<!-- 永不水合（純靜態內容）-->
@defer (hydrate never) {
<static-footer />
}
```

增量水合的好處：

- 服務端輸出完整 HTML（SEO 友好）
- 客户端只水合用户可見/交互的部分
- 首次交互時間（TTI）大幅縮短
- 對於內容密集型頁面（新聞、博客）效果最明顯

## 模板 HMR（Hot Module Replacement）

Angular 19 正式支持組件**模板**的熱更新——修改 `.html` 模板文件後，無需刷新整個頁面，只更新對應組件的視圖，保留應用狀態：

```bash
ng serve
# 修改 app.component.html → 僅更新 AppComponent 的視圖，狀態保留
# 修改 product-card.component.html → 僅更新所有 ProductCard 實例
# 修改 .ts 文件 → 仍然全頁刷新（組件邏輯變更，狀態重置）
```

這對錶單密集型應用特別有價值——開發中反覆調整表單佈局時，不再因 HMR 導致已填寫的數據丟失。

## 路由級渲染模式（穩定化）

Angular 18 引入、19 進一步穩定的路由級渲染模式：

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  {
    path: "", // 首頁：預渲染（構建時生成靜態 HTML）
    renderMode: RenderMode.Prerender,
  },
  {
    path: "blog/:slug", // 博客文章：預渲染（需要提供所有可能的 slug）
    renderMode: RenderMode.Prerender,
  },
  {
    path: "dashboard", // 儀表盤：服務端渲染（每次請求動態生成）
    renderMode: RenderMode.Server,
  },
  {
    path: "profile", // 個人主頁：純客户端渲染
    renderMode: RenderMode.Client,
  },
  {
    path: "**", // 其餘路由：SSR 兜底
    renderMode: RenderMode.Server,
  },
];
```

## linkedSignal 正式穩定（預期）

Angular 18.2 引入的實驗性 `linkedSignal()` 預計在 19 中穩定：

```typescript
// Angular 19 中 linkedSignal 預計去掉實驗標記
import { linkedSignal } from '@angular/core';

@Component({ standalone: true, ... })
export class TabsComponent {
  tabs = input.required<Tab[]>();

  // 當 tabs 變化時自動重置到第一個 tab，但用户切換後本地狀態有效
  activeTab = linkedSignal(() => this.tabs()[0]);
}
```

## Zoneless 變更檢測：從實驗到推薦

Angular 19 中 Zoneless 模式從"實驗性"提升為"開發者預覽"：

```typescript
// Angular 18：provideExperimentalZonelessChangeDetection()（實驗性）
// Angular 19：provideZonelessChangeDetection()（開發者預覽，去掉 Experimental）
import { provideZonelessChangeDetection } from "@angular/core";

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
});
```

## 總結

Angular 19 的增量水合是 SSR 性能的重大提升，結合 `@defer` 語法，開發者可以精細控制哪些內容需要立即激活、哪些延遲激活。模板 HMR 則是對開發體驗的直接改善。如果你在關注 Angular 的 SSR 能力，Angular 19 值得認真評估。正式版 11 月 19 日發佈，RC 階段可以開始在測試環境中驗證。
