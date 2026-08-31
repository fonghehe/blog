---
title: "Angular ルート遅延ロードとプリロード戦略の詳解"
date: 2021-01-30 14:35:05
tags:
  - Angular
  - Webpack
  - TypeScript

readingTime: 3
description: "Angular 的路由系统内置了强大的懒加载和预加载机制。合理配置可以让首屏体积减少 40-60%，同时通过预加载确保后续导航几乎无等待。"
wordCount: 711
---

Angular のルーティングシステムには、強力な遅延ロードとプリロードの仕組みが組み込まれています。適切に設定すれば、初期表示のバンドルサイズを 40〜60% 削減でき、さらにプリロードによってその後の画面遷移をほぼ待たずに行えます。

## 遅延ロードの基礎

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

- `canActivate`：権限をチェックするのはナビゲーション時だが、JS チャンクはすでにダウンロード済み
- `canLoad`：権限が不足している場合はチャンクを一切ダウンロードせず、より安全で帯域も節約できる

## 3種類のプリロード戦略

### 1. NoPreloading（默认）

```typescript
RouterModule.forRoot(routes, {
  preloadingStrategy: NoPreloading, // 不预加载，用户导航时才下载
});
```

向いているケース：ネットワーク環境が悪い場面や、モジュールのサイズが特に大きい場合。

### 2. PreloadAllModules

```typescript
import { PreloadAllModules } from "@angular/router";

RouterModule.forRoot(routes, {
  preloadingStrategy: PreloadAllModules, // 首屏后后台下载所有懒加载模块
});
```

向いているケース：アプリケーションが小さく、ユーザーのネットワーク環境が良好な場面。

### 3. 自定义预加载策略（推荐）

プリロード対象のフラグ `preload: true` が付いたルートだけを事前読み込みします：

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

## ネットワーク状態に基づくスマートプリロード

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

## ルート分析とバンドル分割

```bash
# 分析路由对应的 chunk 大小
ng build --stats-json
npx webpack-bundle-analyzer dist/my-app/stats.json
```

実践的なアドバイス：

- **コアとなるルート**（Dashboard、ホーム）：遅延ロードしないことで、リクエストを 1 回減らせます
- **補助的な機能**（設定、マイページ）：遅延ロード ＋ プリロードのマーク付け
- **利用頻度の低い機能**（管理画面、ヘルプセンター）：遅延ロードのみ、プリロードは行わない

## ルートトランジションアニメーション

遅延ロード時は一時的に白い画面が表示される場合があります。Angular Animations と組み合わせて体験を改善しましょう：

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

## まとめ

Angular のルーティングにおける遅延ロードは、大きなパフォーマンス改善を得やすい最適化手法です。カスタムのプリロード戦略と組み合わせることで、「必要に応じた読み込み」と「待たされない画面遷移」の間で最適なバランスを見つけられます。まずは `webpack-bundle-analyzer` で現在の chunk の分布を分析し、それから目的に応じてプリロードするルートにマークを付けることをお勧めします。
