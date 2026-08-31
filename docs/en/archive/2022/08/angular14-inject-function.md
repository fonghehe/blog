---
title: "Angular 14 inject() Function: A New Paradigm for Functional Dependency Injection"
date: 2022-08-17 11:47:50
tags:
  - Angular
readingTime: 2
description: "The inject() function introduced in Angular 14 is a small change with far-reaching impact. It lets you retrieve services directly inside an injection context (component initialization, factory functions, route guards, and so on) instead of forcing constructor injection. This opens the door to a React Hooks-style 'composable' way of writing Angular."
wordCount: 155
---

The inject() function introduced in Angular 14 is a small change with far-reaching impact. It lets you retrieve services directly inside an injection context (component initialization, factory functions, route guards, and so on) instead of forcing constructor injection. This opens the door to a React Hooks-style 'composable' way of writing Angular.

## Basic Usage

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

## Creating Reusable Composable Functions

The biggest value of `inject()` is that it lets you encapsulate service logic into functions reusable across multiple components:

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

## Functional Route Guards

The most important application in Angular 14: functional guards replacing class-based guards:

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

## Functional HTTP Interceptors

Angular 14 also introduced functional HTTP interceptors:

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

## inject() Limitations

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

## Summary

`inject()` is an important step toward functional programming for Angular. It's more than syntax sugar over constructor injection — it genuinely unlocks a Vue Composables-style 'composable logic' pattern, freeing service logic from being locked into class constructors. Combined with Angular 14's Standalone Components, this makes Angular code lighter and more flexible.