---
title: "Angular Router 高度な活用：遅延ロード、ガード、モジュール設計"
date: 2022-03-02 14:50:11
tags:
  - Angular
readingTime: 2
description: "Angular Router 是 Angular 生态中最成熟的路由方案之一。这篇文章深入讲解懒加载配置、路由守卫的各种形式以及大型应用的路由组织模式，适合已经熟悉基础 Angular 路由的开发者。"
wordCount: 240
---

Angular Router 是 Angular 生态中最成熟的路由方案之一。这篇文章深入讲解懒加载配置、路由守卫的各种形式以及大型应用的路由组织模式，适合已经熟悉基础 Angular 路由的开发者。

## 懒加载配置

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

**canLoad vs canActivate 的区别**：

- `canActivate`：每次访问路由时检查，但代码已下载
- `canLoad`：阻止懒加载模块的代码**下载**，更彻底的权限控制

## 路由守卫类型

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

## 数据预加载（Resolver）

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

## 路由预加载策略

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

## 大型应用路由组织

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

## 路由动画

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

## まとめ

Angular Router 的功能远不止基础路由配置。`canLoad` 在权限控制上比 `canActivate` 更彻底；`Resolve` 守卫确保组件渲染时数据已就绪；自定义预加载策略能精确控制模块下载时机。合理使用这些特性，可以让大型 Angular 应用的路由层既安全又高效。