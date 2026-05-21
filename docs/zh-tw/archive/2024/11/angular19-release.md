---
title: "Angular 19 正式釋出：增量水合、路由級渲染與 Zoneless 開發者預覽"
date: 2024-11-20 10:00:00
tags:
  - Angular
  - CSS
readingTime: 2
description: "Angular 19 於 2024 年 11 月 19 日正式釋出。這是 Angular 近年來在 SSR 能力和響應式模型上變化最大的版本之一。主要亮點：增量水合（Incremental Hydration）正式可用、路由級渲染模式穩定、Zoneless 提升為開發者預覽、模板 HMR 正式支援。"
wordCount: 412
---

Angular 19 於 2024 年 11 月 19 日正式釋出。這是 Angular 近年來在 SSR 能力和響應式模型上變化最大的版本之一。主要亮點：增量水合（Incremental Hydration）正式可用、路由級渲染模式穩定、Zoneless 提升為開發者預覽、模板 HMR 正式支援。

## 增量水合：SSR 效能的新臺階

全量水合會在頁面載入時啟用所有元件，即使使用者看不到或不需要它們。增量水合讓每個 `@defer` 塊可以獨立控制何時水合：

```typescript
// 1. 開啟增量水合
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

```html
<!-- 2. 在模板中宣告水合策略 -->
<!-- 進入視口時水合（低優先順序內容推薦） -->
@defer (hydrate on viewport) {
<comments-section />
}

<!-- 使用者互動時水合（富互動元件） -->
@defer (hydrate on interaction) {
<rich-text-editor [(content)]="articleBody" />
}

<!-- 立即水合（關鍵內容） -->
@defer (hydrate immediately) {
<product-hero [product]="featured" />
}

<!-- 永不水合：服務端渲染後作為靜態 HTML 保留 -->
@defer (hydrate never) {
<legal-footer />
}
```

**效能對比（典型內容頁，40 個元件）**：

```
全量水合（Angular 17/18）：
  服務端 HTML → 全部 40 個元件同時啟用
  TTI: ~1.8s, TBT: ~320ms

增量水合（Angular 19）：
  服務端 HTML → 僅啟用視口內 6 個元件
  其餘元件在使用者滾動/互動時按需啟用
  TTI: ~0.6s, TBT: ~80ms
```

## 路由級渲染模式（正式穩定）

每條路由可以獨立選擇 SSR、預渲染或 CSR：

```typescript
// app.routes.server.ts（Angular 19 穩定 API）
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  { path: "", renderMode: RenderMode.Prerender },
  { path: "products", renderMode: RenderMode.Prerender },
  { path: "products/:id", renderMode: RenderMode.Server }, // 動態 SSR
  { path: "checkout", renderMode: RenderMode.Client }, // 純 CSR（無需 SEO）
  { path: "**", renderMode: RenderMode.Server },
];
```

## Zoneless：從實驗到開發者預覽

```typescript
// Angular 18：provideExperimentalZonelessChangeDetection()
// Angular 19：API 更名，去掉 Experimental
import { provideZonelessChangeDetection } from "@angular/core";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // 開發者預覽，可用於生產評估
  ],
});
```

同時從 `angular.json` 的 `polyfills` 中移除 `zone.js`，包體積減少約 33KB。

## 模板 HMR（Hot Module Replacement）

```bash
ng serve
# 修改 .component.html → 僅更新對應元件的檢視，應用狀態保留
# 修改 .component.css  → 樣式即時注入，無重新整理
# 修改 .component.ts   → 全量重新整理（邏輯變更需重置狀態）
```

對錶單場景的幫助最大：調整表單佈局時，不再因 HMR 導致已輸入的內容丟失。

## linkedSignal() 穩定

```typescript
import { linkedSignal, input, Component } from '@angular/core';

@Component({ standalone: true, ... })
export class ListWithSelectionComponent {
  items = input.required<Item[]>();

  // 當 items 變化時重置選中項；使用者可以手動修改選中項
  selectedItem = linkedSignal(() => this.items()[0] ?? null);
}
```

## Signal-based 元件：OnPush 即將成為預設

Angular 19 釋出了 RFC，計劃在未來版本將 `OnPush` 作為新專案的預設變更檢測策略（配合 Signals 使用）。現在可以在新元件中主動採用：

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // 現在推薦明確宣告
  template: `{{ user().name }}`,
})
export class UserComponent {
  user = input.required<User>();
}
```

## 升級到 Angular 19

```bash
ng update @angular/core@19 @angular/cli@19

# 檢視自動遷移選項
ng update @angular/core@19 --from=18 --dry-run
```

## 總結

Angular 19 在 SSR 方向邁出了重要一步：增量水合解決了全量啟用的效能開銷，路由級渲染模式讓架構決策更細粒度。Zoneless 開發者預覽標誌著 Angular 正式進入"去 zone.js"的穩定階段。如果你的 Angular 應用有 SSR 需求，Angular 19 是值得認真規劃升級的版本。
