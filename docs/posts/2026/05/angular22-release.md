---
title: "Angular 22 正式发布：Evergreen 编译器驱动的新时代"
date: 2026-05-07 10:00:00
tags:
  - Angular
---

Angular 22 于 2026 年 5 月 7 日正式发布。继上月 RC 预览之后，正式版带来了几项最终打磨：Evergreen 编译器生产可用，Zoneless 成为新项目默认模式，以及对 Server-Side Rendering 的全面重构。在前端三大框架各自走向成熟的 2026 年，Angular 22 交出了一份完整的答卷。

## Evergreen 编译器：生产验证结果

RC 阶段大量社区项目参与了测试，正式版汇总了真实数据：

```
社区反馈统计（来自 Angular GitHub Discussions）：

冷启动速度提升：
  P50（中位数）: -52%
  P90: -61%
  P99（超大项目）: -64%

热重载速度提升：
  P50: -58%
  P90: -67%

包体积减少（tree-shaking 改进）：
  P50: -8%
  P90: -14%
```

## 完整的 SSR 重构：Angular Universal 2.0

Angular 22 对服务端渲染架构做了彻底重构，正式引入流式 SSR 和边缘渲染支持：

```typescript
// app.config.server.ts
import {
  provideServerRendering,
  withStreamingSSR,
} from "@angular/platform-server";

export const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      // 22 新增：流式 SSR，首字节时间大幅提前
      withStreamingSSR({
        // shell 内容立即发送，数据加载完成后流式追加
        shellTimeout: 100, // ms
      }),
    ),
  ],
};
```

```typescript
// 在组件中声明 SSR 边界
@Component({
  template: `
    <!-- 立即渲染的 shell -->
    <app-header />
    <app-hero />

    <!-- 延迟流式渲染的内容 -->
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

Angular 22 引入了完全基于 Signal 的路由 API（Signal Router），现有 Router 将进入维护模式：

```typescript
import { signalRouter, route } from "@angular/router/signal";

// app.routes.ts
export const routes = signalRouter([
  route("/", () => import("./home.component").then((m) => m.HomeComponent)),
  route(
    "/products",
    () => import("./products.component").then((m) => m.ProductsComponent),
    {
      // 路由参数自动成为 Signal
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
// 在组件中使用路由 Signal
import { injectRouteParam, injectQueryParam } from "@angular/router/signal";

@Component({ template: `<h1>{{ product().name }}</h1>` })
export class ProductDetailComponent {
  // 路由参数自动作为 Signal，变化时自动重新请求
  productId = injectRouteParam("id", { transform: Number });
  tab = injectQueryParam("tab", { defaultValue: "info" });

  product = httpResource<Product>(() => `/api/products/${this.productId()}`);
}
```

## 与 React 22 / Vue 5 的横向对比

2026 年中，三大框架的主要竞争维度已从"功能完整性"转向"开发体验"：

| 维度       | Angular 22     | React 22          | Vue 5                |
| ---------- | -------------- | ----------------- | -------------------- |
| 响应式模型 | Signal（内置） | Signal（内置）    | Vapor（Signal-like） |
| 编译期优化 | Evergreen ⭐   | React Compiler    | Vapor 编译器         |
| SSR 支持   | 流式 + 边缘    | Server Components | Nuxt 5 集成          |
| 类型安全   | 全链路 TS      | 全链路 TS         | 全链路 TS            |
| 学习曲线   | 中高           | 中                | 低中                 |
| 企业采用   | 高             | 高                | 中                   |

## 升级到 Angular 22

```bash
ng update @angular/core@22 @angular/cli@22 @angular/router@22 @angular/forms@22
```

主要迁移注意事项：

1. **Zoneless 迁移**：正式版提供了 `ng generate @angular/core:zoneless-migration` schematic，可自动完成大部分迁移工作
2. **Signal Router 迁移**：现有 Routes 数组配置仍然有效，无需立即迁移；但新路由功能仅在 Signal Router 中可用
3. **`NgModule` 逐步移除**：建议使用 `ng generate @angular/core:remove-unused-ngmodules` 清理空的 NgModule

## 总结

Angular 22 标志着 Angular 历时三年的现代化转型全面完成。从 Angular 14 引入独立组件、16 带来 Signal 预览、20 完成 Zoneless 稳定，到如今 22 的 Evergreen 编译器与 Signal Router，这条路线一以贯之。对于新项目，Angular 22 提供的开发体验已经足够流畅；对于存量项目，平滑的迁移路径让升级不再是一场豪赌。
