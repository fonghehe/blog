---
title: "Angularの遅延ロード：初期バンドルサイズの削減"
date: 2019-04-01 10:45:14
tags:
  - Angular
readingTime: 1
description: "Angularのルートベースの遅延ロードは、大規模アプリケーションの初期ロードパフォーマンスを最適化するための重要な手法です。"
wordCount: 156
---

Angularのルートベースの遅延ロードは、大規模アプリケーションの初期ロードパフォーマンスを最適化するための重要な手法です。

## 遅延ロードの設定

```typescript
const routes: Routes = [
  {
    path: "admin",
    loadChildren: () =>
      import("./admin/admin.module").then((m) => m.AdminModule),
  },
  {
    path: "shop",
    loadChildren: () => import("./shop/shop.module").then((m) => m.ShopModule),
  },
];
```

## プリロード戦略

```typescript
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules  // アイドル時にプリロード
    })
  ]
})
```

カスタム戦略：`preload: true`がマークされたモジュールのみプリロード：

```typescript
@Injectable({ providedIn: "root" })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return route.data?.["preload"] ? load() : of(null);
  }
}
```

## 効果

適切なコード分割を行うと、初期バンドルサイズを40%〜60%削減できます。サーバーサイドのHTTP/2プッシュと組み合わせると、さらに効果的です。
