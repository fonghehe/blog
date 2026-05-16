---
title: "Angular Lazy Loading: Reducing Initial Bundle Size"
date: 2019-04-01 10:45:14
tags:
  - Angular
readingTime: 1
description: "Angular's built-in route-based lazy loading is a key technique for optimizing the initial load performance of large applications."
---

Angular's built-in route-based lazy loading is a key technique for optimizing the initial load performance of large applications.

## Configuring Lazy Loading

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

## Preloading Strategies

```typescript
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules  // preload during idle time
    })
  ]
})
```

Custom strategy — only preload modules flagged with `preload: true`:

```typescript
@Injectable({ providedIn: "root" })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return route.data?.["preload"] ? load() : of(null);
  }
}
```

## Results

With proper code splitting, the initial bundle size can be reduced by 40%–60%. Combined with server-side HTTP/2 push, the effect is even better.
