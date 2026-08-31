---
title: "Angular Router Advanced: Lazy Loading, Guards, and Modular Design"
date: 2022-03-02 14:50:11
tags:
  - Angular
readingTime: 2
description: "Angular Router is one of the most mature routing solutions in the Angular ecosystem. This article dives into lazy-loading configuration, the various forms of route guards, and routing organization patterns for large applications — aimed at developers already comfortable with basic Angular routing."
wordCount: 157
---

Angular Router is one of the most mature routing solutions in the Angular ecosystem. This article dives into lazy-loading configuration, the various forms of route guards, and routing organization patterns for large applications — aimed at developers already comfortable with basic Angular routing.

## Lazy Loading Configuration

```typescript
// app-routing.module.ts
const routes: Routes = [
  { path: "", redirectTo: "/home", pathMatch: "full" },
  {
    path: "home",
    loadChildren: () => import("./home/home.module").then((m) => m.HomeModule),
  },
  {
    path: "admin",
    // 只有满足 canLoad 才会加载模块代码
    canLoad: [AuthGuard],
    loadChildren: () =>
      import("./admin/admin.module").then((m) => m.AdminModule),
  },
  {
    path: "products",
    loadChildren: () =>
      import("./products/products.module").then((m) => m.ProductsModule),
  },
];
```

**The difference between canLoad and canActivate**:

- `canActivate`: checked every time the route is accessed, but the code has already been downloaded
- `canLoad`: prevents the lazy-loaded module's code from being **downloaded** at all, providing more thorough access control

## Route Guard Types

```typescript
// auth.guard.ts
@Injectable({ providedIn: "root" })
export class AuthGuard implements CanActivate, CanLoad, CanActivateChild {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  // 拦截单个路由访问
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.checkAuth(state.url);
  }

  // 拦截子路由访问
  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.checkAuth(state.url);
  }

  // 拦截懒加载模块的下载
  canLoad(route: Route, segments: UrlSegment[]) {
    const url = segments.map((s) => s.path).join("/");
    return this.checkAuth("/" + url);
  }

  private checkAuth(redirectUrl: string): boolean | UrlTree {
    if (this.auth.isLoggedIn()) return true;
    return this.router.createUrlTree(["/login"], {
      queryParams: { returnUrl: redirectUrl },
    });
  }
}
```

## Data Preloading (Resolver)

```typescript
// product.resolver.ts
@Injectable({ providedIn: 'root' })
export class ProductResolver implements Resolve<Product> {
  constructor(private productService: ProductService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Product> {
    const id = route.paramMap.get('id')!;
    return this.productService.getProduct(id).pipe(
      catchError(() => {
        // 产品不存在，跳回列表
        return EMPTY;
      })
    );
  }
}

// 路由配置中使用
{
  path: 'products/:id',
  component: ProductDetailComponent,
  resolve: { product: ProductResolver },
  canActivate: [AuthGuard]
}

// 组件中获取
@Component({...})
export class ProductDetailComponent {
  product = this.route.snapshot.data['product'] as Product;
  constructor(private route: ActivatedRoute) {}
}
```

## Route Preloading Strategies

```typescript
// app.module.ts - 路由模块配置
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      // 空闲时预加载所有懒加载模块
      preloadingStrategy: PreloadAllModules,
      // 启用 scroll position 恢复
      scrollPositionRestoration: 'enabled',
      // 让 Angular 知道锚点
      anchorScrolling: 'enabled'
    })
  ]
})
export class AppModule {}

// 自定义预加载策略：只预加载标记了 data.preload: true 的模块
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    if (route.data?.['preload']) {
      console.log('Preloading:', route.path);
      return load();
    }
    return of(null);
  }
}

// 路由配置
{ path: 'products', data: { preload: true }, loadChildren: () => ... }
```

## Routing Organization for Large Applications

```typescript
// 按功能模块组织路由
// feature/dashboard/dashboard-routing.module.ts
const dashboardRoutes: Routes = [
  {
    path: "",
    component: DashboardShellComponent,
    canActivateChild: [AuthGuard],
    children: [
      { path: "", redirectTo: "overview", pathMatch: "full" },
      { path: "overview", component: OverviewComponent },
      { path: "analytics", component: AnalyticsComponent },
      {
        path: "settings",
        loadChildren: () =>
          import("../settings/settings.module").then((m) => m.SettingsModule),
      },
    ],
  },
];
```

## Route Animations

```typescript
@Component({
  selector: "app-root",
  template: `
    <div [@routeAnimations]="getRouteAnimation(outlet)">
      <router-outlet #outlet="outlet"></router-outlet>
    </div>
  `,
  animations: [
    trigger("routeAnimations", [
      transition("* <=> *", [
        style({ opacity: 0, transform: "translateY(20px)" }),
        animate(
          "300ms ease",
          style({ opacity: 1, transform: "translateY(0)" }),
        ),
      ]),
    ]),
  ],
})
export class AppComponent {
  getRouteAnimation(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.["animation"] ?? "none";
  }
}
```

## Summary

Angular Router goes far beyond basic route configuration. `canLoad` provides more thorough access control than `canActivate`; the `Resolve` guard ensures data is ready before a component renders; and custom preloading strategies give you precise control over when modules are downloaded. Used wisely, these features make the routing layer of a large Angular application both secure and efficient.