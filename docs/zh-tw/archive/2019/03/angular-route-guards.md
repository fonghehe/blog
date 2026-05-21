---
title: "Angular 路由守衛：許可權控制最佳實踐"
date: 2019-03-13 15:35:38
tags:
  - Angular
readingTime: 1
description: "Angular Router 提供多種守衛介面，可以精細控制路由訪問許可權。"
wordCount: 81
---

Angular Router 提供多種守衛介面，可以精細控制路由訪問許可權。

## CanActivate

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (this.auth.isLoggedIn()) return true;
    return this.router.createUrlTree(['/login']);
  }
}
```

路由配置：

```typescript
const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  }
];
```

## CanDeactivate

防止使用者意外離開未儲存的表單：

```typescript
@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard implements CanDeactivate<unknown> {
  canDeactivate(component: any): boolean {
    if (component.hasUnsavedChanges?.()) {
      return confirm('有未儲存的修改，確定離開？');
    }
    return true;
  }
}
```

## Resolve - 預載入資料

```typescript
@Injectable({ providedIn: 'root' })
export class UserResolver implements Resolve<User> {
  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    return this.userService.getUser(route.params['id']);
  }
}
```

合理使用路由守衛能讓許可權邏輯集中管理，避免散落在元件中。