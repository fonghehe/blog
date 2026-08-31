---
title: "Angular Route Lazy Loading and Preloading Strategies Explained"
date: 2021-01-30 14:35:05
tags:
  - Angular
  - Webpack
  - TypeScript

readingTime: 2
description: "Angular's router ships powerful built-in lazy-loading and preloading mechanisms. Configured well, they can cut the initial bundle by 40-60% while preloading keeps subsequent navigation virtually wait-free."
wordCount: 225
---

Angular's routing system has built-in, powerful lazy-loading and preloading mechanisms. With the right configuration, you can shrink the initial bundle by 40–60%, while preloading keeps subsequent navigation nearly instant.

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

**The difference between canLoad and canActivate:**

- `canActivate`: checks permissions at navigation time, but the JS chunk is already downloaded
- `canLoad`: when permissions are insufficient, the chunk is never downloaded at all — more secure and lighter on bandwidth

## Three Preloading Strategies

### 1. NoPreloading (Default)

```typescript
RouterModule.forRoot(routes, {
  preloadingStrategy: NoPreloading, // 不预加载，用户导航时才下载
});
```

Best for: poor network conditions, or modules that are especially large.

### 2. PreloadAllModules

```typescript
import { PreloadAllModules } from "@angular/router";

RouterModule.forRoot(routes, {
  preloadingStrategy: PreloadAllModules, // 首屏后后台下载所有懒加载模块
});
```

Best for: small apps where users have a good network connection.

### 3. Custom Preloading Strategy (Recommended)

Only preload routes flagged with `preload: true`:

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

Practical recommendations:

- **Core routes** (Dashboard, home page): you can skip lazy loading to avoid an extra request
- **Secondary features** (settings, profile): lazy-load and flag for preloading
- **Low-frequency features** (admin, help center): lazy-load but don't preload

## Route Transition Animations

Lazy loading can cause a brief white flash; pair it with Angular Animations to smooth the experience:

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

Route-level lazy loading is one of the easiest wins for a noticeable performance boost in Angular. Combined with a custom preloading strategy, it strikes the best balance between on-demand loading and seamless navigation. I'd start with `webpack-bundle-analyzer` to understand your current chunk distribution, then selectively flag routes for preloading.
