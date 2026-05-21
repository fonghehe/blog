---
title: "Angular 22 正式發佈：Evergreen 編譯器驅動的新時代"
date: 2026-05-07 10:00:00
tags:
  - Angular
readingTime: 3
description: "Angular 22 於 2026 年 5 月 7 日正式發佈。繼上月 RC 預覽之後，正式版帶來了幾項最終打磨：Evergreen 編譯器生產可用，Zoneless 成為新項目默認模式，以及對 Server-Side Rendering 的全面重構。在前端三大框架各自走向成熟的 2026 年，Angular 22 交"
wordCount: 529
---

Angular 22 於 2026 年 5 月 7 日正式發佈。繼上月 RC 預覽之後，正式版帶來了幾項最終打磨：Evergreen 編譯器生產可用，Zoneless 成為新項目默認模式，以及對 Server-Side Rendering 的全面重構。在前端三大框架各自走向成熟的 2026 年，Angular 22 交出了一份完整的答卷。

## Evergreen 編譯器：生產驗證結果

RC 階段大量社區項目參與了測試，正式版彙總了真實數據：

```
社區反饋統計（來自 Angular GitHub Discussions）：

冷啓動速度提升：
  P50（中位數）: -52%
  P90: -61%
  P99（超大項目）: -64%

熱重載速度提升：
  P50: -58%
  P90: -67%

包體積減少（tree-shaking 改進）：
  P50: -8%
  P90: -14%
```

## 完整的 SSR 重構：Angular Universal 2.0

Angular 22 對服務端渲染架構做了徹底重構，正式引入流式 SSR 和邊緣渲染支持：

```typescript
// app.config.server.ts
import {
  provideServerRendering,
  withStreamingSSR,
} from "@angular/platform-server";

export const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      // 22 新增：流式 SSR，首字節時間大幅提前
      withStreamingSSR({
        // shell 內容立即發送，數據加載完成後流式追加
        shellTimeout: 100, // ms
      }),
    ),
  ],
};
```

```typescript
// 在組件中聲明 SSR 邊界
@Component({
  template: `
    <!-- 立即渲染的 shell -->
    <app-header />
    <app-hero />

    <!-- 延遲流式渲染的內容 -->
    @defer (on server-ready) {
      <app-product-list [products]="products()" />
    } @placeholder {
      <app-skeleton rows="6" />
    }
  `,
})
export class HomeComponent {
  products = httpResource<Product[]>(() => "/api/products/featured");
}
```

## Signal 路由：全新的路由 API

Angular 22 引入了完全基於 Signal 的路由 API（Signal Router），現有 Router 將進入維護模式：

```typescript
import { signalRouter, route } from "@angular/router/signal";

// app.routes.ts
export const routes = signalRouter([
  route("/", () => import("./home.component").then((m) => m.HomeComponent)),
  route(
    "/products",
    () => import("./products.component").then((m) => m.ProductsComponent),
    {
      // 路由參數自動成為 Signal
      children: [
        route(":id", () =>
          import("./product-detail.component").then(
            (m) => m.ProductDetailComponent,
          ),
        ),
      ],
    },
  ),
]);
```

```typescript
// 在組件中使用路由 Signal
import { injectRouteParam, injectQueryParam } from "@angular/router/signal";

@Component({ template: `<h1>{{ product().name }}</h1>` })
export class ProductDetailComponent {
  // 路由參數自動作為 Signal，變化時自動重新請求
  productId = injectRouteParam("id", { transform: Number });
  tab = injectQueryParam("tab", { defaultValue: "info" });

  product = httpResource<Product>(() => `/api/products/${this.productId()}`);
}
```

## 與 React 22 / Vue 5 的橫向對比

2026 年中，三大框架的主要競爭維度已從"功能完整性"轉向"開發體驗"：

| 維度       | Angular 22     | React 22          | Vue 5                |
| ---------- | -------------- | ----------------- | -------------------- |
| 響應式模型 | Signal（內置） | Signal（內置）    | Vapor（Signal-like） |
| 編譯期優化 | Evergreen ⭐   | React Compiler    | Vapor 編譯器         |
| SSR 支持   | 流式 + 邊緣    | Server Components | Nuxt 5 集成          |
| 類型安全   | 全鏈路 TS      | 全鏈路 TS         | 全鏈路 TS            |
| 學習曲線   | 中高           | 中                | 低中                 |
| 企業採用   | 高             | 高                | 中                   |

## 升級到 Angular 22

```bash
ng update @angular/core@22 @angular/cli@22 @angular/router@22 @angular/forms@22
```

主要遷移注意事項：

1. **Zoneless 遷移**：正式版提供了 `ng generate @angular/core:zoneless-migration` schematic，可自動完成大部分遷移工作
2. **Signal Router 遷移**：現有 Routes 數組配置仍然有效，無需立即遷移；但新路由功能僅在 Signal Router 中可用
3. **`NgModule` 逐步移除**：建議使用 `ng generate @angular/core:remove-unused-ngmodules` 清理空的 NgModule

## 總結

Angular 22 標誌着 Angular 歷時三年的現代化轉型全面完成。從 Angular 14 引入獨立組件、16 帶來 Signal 預覽、20 完成 Zoneless 穩定，到如今 22 的 Evergreen 編譯器與 Signal Router，這條路線一以貫之。對於新項目，Angular 22 提供的開發體驗已經足夠流暢；對於存量項目，平滑的遷移路徑讓升級不再是一場豪賭。
