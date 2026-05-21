---
title: "Angular 懒加载：减少首屏包体积"
date: 2019-04-01 10:45:14
tags:
  - Angular
readingTime: 1
description: "Angular 内置的路由懒加载是优化大型应用首屏性能的关键手段。"
wordCount: 85
---

Angular 内置的路由懒加载是优化大型应用首屏性能的关键手段。

## 配置懒加载

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

## 预加载策略

```typescript
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules  // 空闲时预加载
    })
  ]
})
```

自定义策略：只预加载标记了 `preload: true` 的模块：

```typescript
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return route.data?.['preload'] ? load() : of(null);
  }
}
```

## 效果

合理拆分后，首屏包体积可减少 40%-60%，配合服务端 HTTP/2 推送效果更好。