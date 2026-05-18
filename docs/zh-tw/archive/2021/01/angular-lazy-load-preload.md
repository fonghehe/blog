---
title: "Angular 路由懶載入與預載入策略詳解"
date: 2021-01-30 14:35:05
tags:
  - Angular
  - Webpack
  - TypeScript
readingTime: 2
description: "Angular 的路由系統內建了強大的懶載入和預載入機制。合理配置可以讓首屏體積減少 40-60%，同時通過預載入確保後續導航幾乎無等待。"
---

Angular 的路由系統內建了強大的懶載入和預載入機制。合理配置可以讓首屏體積減少 40-60%，同時通過預載入確保後續導航幾乎無等待。

## 懶載入基礎

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
    canLoad: [AuthGuard], // 未授權時不下載 chunk
    loadChildren: () =>
      import("./admin/admin.module").then((m) => m.AdminModule),
  },
];
```

**canLoad vs canActivate 的區別**：

- `canActivate`：導航時檢查許可權，但 JS chunk 已經下載
- `canLoad`：許可權不足時完全不下載 chunk，更安全也更節省頻寬

## 三種預載入策略

### 1. NoPreloading（預設）

```typescript
RouterModule.forRoot(routes, {
  preloadingStrategy: NoPreloading, // 不預載入，使用者導航時才下載
});
```

適合：網路條件差的場景，或模組體積特別大。

### 2. PreloadAllModules

```typescript
import { PreloadAllModules } from "@angular/router";

RouterModule.forRoot(routes, {
  preloadingStrategy: PreloadAllModules, // 首屏後後臺下載所有懶載入模組
});
```

適合：應用不大、使用者網路好的場景。

### 3. 自定義預載入策略（推薦）

只預載入標記了 `preload: true` 的路由：

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
    data: { preload: true }, // 標記需要預載入
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
  {
    path: "settings",
    // 不標記，按需載入
    loadChildren: () =>
      import("./settings/settings.module").then((m) => m.SettingsModule),
  },
];

RouterModule.forRoot(routes, {
  preloadingStrategy: SelectivePreloadStrategy,
});
```

## 基於網路狀態的智慧預載入

```typescript
@Injectable({ providedIn: "root" })
export class NetworkAwarePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const connection = (navigator as any).connection;

    // 網路差時不預載入
    if (connection?.saveData || connection?.effectiveType === "2g") {
      return of(null);
    }

    return route.data?.["preload"] ? load() : of(null);
  }
}
```

## 路由分析與 Bundle 分割

```bash
# 分析路由對應的 chunk 大小
ng build --stats-json
npx webpack-bundle-analyzer dist/my-app/stats.json
```

實踐建議：

- **核心路由**（Dashboard、首頁）：可以不懶載入，減少一次請求
- **次要功能**（設定、個人中心）：懶載入 + 標記預載入
- **低頻功能**（管理後臺、幫助中心）：懶載入，不預載入

## 路由過渡動畫

懶載入時頁面可能有短暫白屏，配合 Angular Animations 最佳化體驗：

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

## 總結

Angular 路由懶載入是最容易獲得顯著效能提升的最佳化手段。配合自定義預載入策略，可以在"按需載入"和"無感知導航"之間找到最佳平衡點。建議先用 `webpack-bundle-analyzer` 分析當前 chunk 分佈，再有針對性地標記預載入路由。
