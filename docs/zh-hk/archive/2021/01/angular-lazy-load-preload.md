---
title: "Angular 路由懶加載與預加載策略詳解：落地路徑與實戰建議"
date: 2021-01-30 14:35:05
tags:
  - Angular
  - Webpack
  - TypeScript
readingTime: 2
description: "Angular 的路由系統內置了強大的懶加載和預加載機製。合理設定可以讓首屏體積減少 40-60%，同時通過預加載確保後續導航幾乎無等待。"
wordCount: 371
---

Angular 的路由系統內置了強大的懶加載和預加載機製。合理設定可以讓首屏體積減少 40-60%，同時通過預加載確保後續導航幾乎無等待。

## 懶加載基礎

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

- `canActivate`：導航時檢查權限，但 JS chunk 已經下載
- `canLoad`：權限不足時完全不下載 chunk，更安全也更節省帶寬

## 三種預加載策略

### 1. NoPreloading（默認）

```typescript
RouterModule.forRoot(routes, {
  preloadingStrategy: NoPreloading, // 不預加載，用户導航時才下載
});
```

適合：網絡條件差的場景，或模塊體積特別大。

### 2. PreloadAllModules

```typescript
import { PreloadAllModules } from "@angular/router";

RouterModule.forRoot(routes, {
  preloadingStrategy: PreloadAllModules, // 首屏後後臺下載所有懶加載模塊
});
```

適合：應用不大、用户網絡好的場景。

### 3. 自定義預加載策略（推薦）

隻預加載標記了 `preload: true` 的路由：

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
    data: { preload: true }, // 標記需要預加載
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
  {
    path: "settings",
    // 不標記，按需加載
    loadChildren: () =>
      import("./settings/settings.module").then((m) => m.SettingsModule),
  },
];

RouterModule.forRoot(routes, {
  preloadingStrategy: SelectivePreloadStrategy,
});
```

## 基於網絡狀態的智能預加載

```typescript
@Injectable({ providedIn: "root" })
export class NetworkAwarePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const connection = (navigator as any).connection;

    // 網絡差時不預加載
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

- **核心路由**（Dashboard、首頁）：可以不懶加載，減少一次請求
- **次要功能**（設置、個人中心）：懶加載 + 標記預加載
- **低頻功能**（管理後臺、幫助中心）：懶加載，不預加載

## 路由過渡動畫

懶加載時頁面可能有短暫白屏，配合 Angular Animations 優化體驗：

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

Angular 路由懶加載是最容易獲得顯著效能提升的優化手段。配合自定義預加載策略，可以在"按需加載"和"無感知導航"之間找到最佳平衡點。建議先用 `webpack-bundle-analyzer` 分析當前 chunk 分佈，再有針對性地標記預加載路由。
