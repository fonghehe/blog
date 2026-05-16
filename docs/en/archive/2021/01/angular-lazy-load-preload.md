---
title: "Angular Route Lazy Loading and Preloading Strategies Explained"
date: 2021-01-30 14:35:05
tags:
  - Angular
  - Webpack
  - TypeScript

readingTime: 2
description: "Angular 的路由系统内置了强大的懒加载和预加载机制。合理配置可以让首屏体积减少 40-60%，同时通过预加载确保后续导航几乎无等待。"
---

Angular 的路由系统内置了强大的懒加载和预加载机制。合理配置可以让首屏体积减少 40-60%，同时通过预加载确保后续导航几乎无等待。

## Lazy Loading Basics

```typescript
// app-routing.module.ts
const routes: Routes = [
  { path: "", redirectTo: "/dashboard", pathMatch: "full" },
  {
    path: "dashboard",
    loadChildren: () =>
      import("./dashboard/dashboard.module").then((m) => m.DashboardModule),
  },
  {
    path: "users",
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
  {
    path: "admin",
    canLoad: [AuthGuard], // 未授权时不下载 chunk
    loadChildren: () =>
      import("./admin/admin.module").then((m) => m.AdminModule),
  },
];
```

**canLoad vs canActivate 的区别**：

- `canActivate`：导航时检查权限，但 JS chunk 已经下载
- `canLoad`：权限不足时完全不下载 chunk，更安全也更节省带宽

## Three Preloading Strategies

### 1. NoPreloading（默认）

```typescript
RouterModule.forRoot(routes, {
  preloadingStrategy: NoPreloading, // 不预加载，用户导航时才下载
});
```

适合：网络条件差的场景，或模块体积特别大。

### 2. PreloadAllModules

```typescript
import { PreloadAllModules } from "@angular/router";

RouterModule.forRoot(routes, {
  preloadingStrategy: PreloadAllModules, // 首屏后后台下载所有懒加载模块
});
```

适合：应用不大、用户网络好的场景。

### 3. 自定义预加载策略（推荐）

只预加载标记了 `preload: true` 的路由：

```typescript
// selective-preload.strategy.ts
import { Injectable } from "@angular/core";
import { PreloadingStrategy, Route } from "@angular/router";
import { Observable, of } from "rxjs";

@Injectable({ providedIn: "root" })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return route.data?.["preload"] ? load() : of(null);
  }
}
```

```typescript
// app-routing.module.ts
const routes: Routes = [
  {
    path: "users",
    data: { preload: true }, // 标记需要预加载
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
  {
    path: "settings",
    // 不标记，按需加载
    loadChildren: () =>
      import("./settings/settings.module").then((m) => m.SettingsModule),
  },
];

RouterModule.forRoot(routes, {
  preloadingStrategy: SelectivePreloadStrategy,
});
```

## Network-Aware Intelligent Preloading

```typescript
@Injectable({ providedIn: "root" })
export class NetworkAwarePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const connection = (navigator as any).connection;

    // 网络差时不预加载
    if (connection?.saveData || connection?.effectiveType === "2g") {
      return of(null);
    }

    return route.data?.["preload"] ? load() : of(null);
  }
}
```

## Route Analysis and Bundle Splitting

```bash
# 分析路由对应的 chunk 大小
ng build --stats-json
npx webpack-bundle-analyzer dist/my-app/stats.json
```

实践建议：

- **核心路由**（Dashboard、首页）：可以不懒加载，减少一次请求
- **次要功能**（设置、个人中心）：懒加载 + 标记预加载
- **低频功能**（管理后台、帮助中心）：懒加载，不预加载

## Route Transition Animations

懒加载时页面可能有短暂白屏，配合 Angular Animations 优化体验：

```typescript
@Component({
  animations: [
    trigger("routeAnimation", [
      transition("* <=> *", [
        style({ opacity: 0, transform: "translateY(10px)" }),
        animate(
          "200ms ease-out",
          style({ opacity: 1, transform: "translateY(0)" }),
        ),
      ]),
    ]),
  ],
  template: `
    <div [@routeAnimation]="getRouteState(outlet)">
      <router-outlet #outlet="outlet"></router-outlet>
    </div>
  `,
})
export class AppComponent {
  getRouteState(outlet: RouterOutlet) {
    return outlet.activatedRouteData?.["animation"];
  }
}
```

## Summary

Angular 路由懒加载是最容易获得显著性能提升的优化手段。配合自定义预加载策略，可以在"按需加载"和"无感知导航"之间找到最佳平衡点。建议先用 `webpack-bundle-analyzer` 分析当前 chunk 分布，再有针对性地标记预加载路由。
