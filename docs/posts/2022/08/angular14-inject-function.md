---
title: "Angular 14 inject() 函数：函数式依赖注入的新范式"
date: 2022-08-17 11:47:50
tags:
  - Angular
---

Angular 14 引入的 `inject()` 函数是一个小改动但影响深远的 API。它允许在 injection context（组件初始化期间、工厂函数、路由守卫等）中直接获取服务，不再强制通过构造函数注入。这开启了一种 React Hooks 风格的"可组合"Angular 开发模式。

## 基本用法

```typescript
import { inject, Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";

@Component({
  selector: "app-user",
  standalone: true,
  template: `...`,
})
export class UserComponent implements OnInit {
  // inject() 替代构造函数注入
  private http = inject(HttpClient);
  private router = inject(Router);

  // 等价于：
  // constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.http.get("/api/user").subscribe((user) => {
      console.log(user);
    });
  }
}
```

## 创建可复用的"组合式函数"

`inject()` 最大的价值在于允许将服务逻辑封装成可在多个组件间复用的函数：

```typescript
// composables/use-auth.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function useAuth() {
  const auth = inject(AuthService);
  const router = inject(Router);

  function logout() {
    auth.clearSession();
    router.navigate(['/login']);
  }

  function requireAuth() {
    if (!auth.isLoggedIn()) {
      router.navigate(['/login']);
      return false;
    }
    return true;
  }

  return {
    user: auth.currentUser$,
    isLoggedIn: auth.isLoggedIn.bind(auth),
    logout,
    requireAuth,
  };
}

// 在组件中使用
@Component({ standalone: true, ... })
export class NavbarComponent {
  auth = useAuth();  // 类似 React 的自定义 Hook

  // 直接使用 auth.logout()、auth.user 等
}
```

## 函数式路由守卫

Angular 14 最重要的应用：函数式守卫取代 class-based 守卫：

```typescript
// guards/auth.guard.ts（Angular 14+ 推荐方式）
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(["/login"], {
    queryParams: { returnUrl: router.url },
  });
};

export const adminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasRole("admin")) return true;
  return router.createUrlTree(["/forbidden"]);
};

// 路由配置中使用（比 class 守卫更简洁）
const routes: Routes = [
  {
    path: "dashboard",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./dashboard.component").then((m) => m.DashboardComponent),
  },
  {
    path: "admin",
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import("./admin/admin.routes").then((m) => m.ADMIN_ROUTES),
  },
];
```

## 函数式 HTTP 拦截器

Angular 14 同样引入了函数式 HTTP 拦截器：

```typescript
// interceptors/auth.interceptor.ts
import { inject } from "@angular/core";
import { HttpInterceptorFn } from "@angular/common/http";
import { AuthService } from "../services/auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    const authReq = req.clone({
      headers: req.headers.set("Authorization", `Bearer ${token}`),
    });
    return next(authReq);
  }

  return next(req);
};

// 在 bootstrapApplication 中注册
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor])),
  ],
});
```

## inject() 的限制

```typescript
// ❌ inject() 只能在 injection context 中调用
setTimeout(() => {
  const service = inject(MyService);  // 报错！不在 injection context
}, 1000);

// ❌ 不能在普通函数中调用（非 injection context）
function someUtil() {
  const service = inject(MyService);  // 报错！
}

// ✅ 可以在字段初始化器中调用
@Component({...})
class MyComponent {
  private service = inject(MyService);  // ✓ 在类字段初始化时执行，属于 injection context
}

// ✅ 可以在构造函数中调用
@Component({...})
class MyComponent {
  constructor() {
    const service = inject(MyService);  // ✓
  }
}
```

## 总结

`inject()` 是 Angular 向函数式编程迈出的重要一步。它不只是构造函数注入的语法糖——它真正开启了类似 Vue Composables 的"可组合逻辑"模式，让服务逻辑不再被锁死在 class 的构造函数里。结合 Angular 14 的 Standalone Components，整个开发体验正在变得更轻量、更函数式。