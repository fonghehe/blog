---
title: "Angular 14 inject() 函數：函數式依賴注入的新範式"
date: 2022-08-17 11:47:50
tags:
  - Angular
readingTime: 2
description: "Angular 14 引入的 `inject()` 函數是一個小改動但影響深遠的 API。它允許在 injection context（組件初始化期間、工廠函數、路由守衞等）中直接獲取服務，不再強製通過構造函數注入。這開啓了一種 React Hooks 風格的\"可組合\"Angular 開發模式。"
wordCount: 277
---

Angular 14 引入的 `inject()` 函數是一個小改動但影響深遠的 API。它允許在 injection context（組件初始化期間、工廠函數、路由守衞等）中直接獲取服務，不再強製通過構造函數注入。這開啓了一種 React Hooks 風格的"可組合"Angular 開發模式。

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
  // inject() 替代構造函數注入
  private http = inject(HttpClient);
  private router = inject(Router);

  // 等價於：
  // constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.http.get("/api/user").subscribe((user) => {
      console.log(user);
    });
  }
}
```

## 創建可複用的"組合式函數"

`inject()` 最大的價值在於允許將服務邏輯封裝成可在多個組件間複用的函數：

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

// 在組件中使用
@Component({ standalone: true, ... })
export class NavbarComponent {
  auth = useAuth();  // 類似 React 的自定義 Hook

  // 直接使用 auth.logout()、auth.user 等
}
```

## 函數式路由守衞

Angular 14 最重要的應用：函數式守衞取代 class-based 守衞：

```typescript
// guards/auth.guard.ts（Angular 14+ 推薦方式）
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

// 路由配置中使用（比 class 守衞更簡潔）
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

## 函數式 HTTP 攔截器

Angular 14 同樣引入了函數式 HTTP 攔截器：

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

// 在 bootstrapApplication 中註冊
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor])),
  ],
});
```

## inject() 的限製

```typescript
// ❌ inject() 隻能在 injection context 中調用
setTimeout(() => {
  const service = inject(MyService);  // 報錯！不在 injection context
}, 1000);

// ❌ 不能在普通函數中調用（非 injection context）
function someUtil() {
  const service = inject(MyService);  // 報錯！
}

// ✅ 可以在字段初始化器中調用
@Component({...})
class MyComponent {
  private service = inject(MyService);  // ✓ 在類字段初始化時執行，屬於 injection context
}

// ✅ 可以在構造函數中調用
@Component({...})
class MyComponent {
  constructor() {
    const service = inject(MyService);  // ✓
  }
}
```

## 總結

`inject()` 是 Angular 向函數式編程邁出的重要一步。它不隻是構造函數注入的語法糖——它真正開啓了類似 Vue Composables 的"可組合邏輯"模式，讓服務邏輯不再被鎖死在 class 的構造函數里。結合 Angular 14 的 Standalone Components，整個開發體驗正在變得更輕量、更函數式。