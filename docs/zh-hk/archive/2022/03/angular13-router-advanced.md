---
title: "Angular Router 進階：懶加載、路由守衞與模塊化設計"
date: 2022-03-02 14:50:11
tags:
  - Angular
readingTime: 2
description: "Angular Router 是 Angular 生態中最成熟的路由方案之一。這篇文章深入講解懶加載配置、路由守衞的各種形式以及大型應用的路由組織模式，適合已經熟悉基礎 Angular 路由的開發者。"
---

Angular Router 是 Angular 生態中最成熟的路由方案之一。這篇文章深入講解懶加載配置、路由守衞的各種形式以及大型應用的路由組織模式，適合已經熟悉基礎 Angular 路由的開發者。

## 懶加載配置

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
    // 只有滿足 canLoad 才會加載模塊代碼
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

**canLoad vs canActivate 的區別**：

- `canActivate`：每次訪問路由時檢查，但代碼已下載
- `canLoad`：阻止懶加載模塊的代碼**下載**，更徹底的權限控制

## 路由守衞類型

```typescript
// auth.guard.ts
@Injectable({ providedIn: "root" })
export class AuthGuard implements CanActivate, CanLoad, CanActivateChild {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  // 攔截單個路由訪問
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.checkAuth(state.url);
  }

  // 攔截子路由訪問
  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.checkAuth(state.url);
  }

  // 攔截懶加載模塊的下載
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

## 數據預加載（Resolver）

```typescript
// product.resolver.ts
@Injectable({ providedIn: 'root' })
export class ProductResolver implements Resolve<Product> {
  constructor(private productService: ProductService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Product> {
    const id = route.paramMap.get('id')!;
    return this.productService.getProduct(id).pipe(
      catchError(() => {
        // 產品不存在，跳回列表
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

// 組件中獲取
@Component({...})
export class ProductDetailComponent {
  product = this.route.snapshot.data['product'] as Product;
  constructor(private route: ActivatedRoute) {}
}
```

## 路由預加載策略

```typescript
// app.module.ts - 路由模塊配置
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      // 空閒時預加載所有懶加載模塊
      preloadingStrategy: PreloadAllModules,
      // 啓用 scroll position 恢復
      scrollPositionRestoration: 'enabled',
      // 讓 Angular 知道錨點
      anchorScrolling: 'enabled'
    })
  ]
})
export class AppModule {}

// 自定義預加載策略：只預加載標記了 data.preload: true 的模塊
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

## 大型應用路由組織

```typescript
// 按功能模塊組織路由
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

## 路由動畫

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

## 總結

Angular Router 的功能遠不止基礎路由配置。`canLoad` 在權限控制上比 `canActivate` 更徹底；`Resolve` 守衞確保組件渲染時數據已就緒；自定義預加載策略能精確控制模塊下載時機。合理使用這些特性，可以讓大型 Angular 應用的路由層既安全又高效。