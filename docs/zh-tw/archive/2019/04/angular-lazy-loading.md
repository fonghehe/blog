---
title: "Angular 懶載入：減少首屏包體積"
date: 2019-04-01 10:45:14
tags:
  - Angular
readingTime: 1
description: "Angular 內建的路由懶載入是最佳化大型應用首屏效能的關鍵手段。"
---

Angular 內建的路由懶載入是最佳化大型應用首屏效能的關鍵手段。

## 配置懶載入

```typescript
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: 'shop',
    loadChildren: () => import('./shop/shop.module').then(m => m.ShopModule)
  }
];
```

## 預載入策略

```typescript
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules  // 空閒時預載入
    })
  ]
})
```

自定義策略：只預載入標記了 `preload: true` 的模組：

```typescript
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return route.data?.['preload'] ? load() : of(null);
  }
}
```

## 效果

合理拆分後，首屏包體積可減少 40%-60%，配合服務端 HTTP/2 推送效果更好。