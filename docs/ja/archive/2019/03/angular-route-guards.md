---
title: "Angularルートガード：権限制御のベストプラクティス"
date: 2019-03-13 15:35:38
tags:
  - Angular
readingTime: 1
description: "Angular Routerは複数のガードインターフェースを提供し、ルートアクセス権限をきめ細かく制御できる。"
---

Angular Routerは複数のガードインターフェースを提供し、ルートアクセス権限をきめ細かく制御できる。

## CanActivate

```typescript
@Injectable({ providedIn: "root" })
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (this.auth.isLoggedIn()) return true;
    return this.router.createUrlTree(["/login"]);
  }
}
```

ルート設定：

```typescript
const routes: Routes = [
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
];
```

## CanDeactivate

ユーザーが未保存のフォームを誤って離れるのを防ぐ：

```typescript
@Injectable({ providedIn: "root" })
export class UnsavedChangesGuard implements CanDeactivate<unknown> {
  canDeactivate(component: any): boolean {
    if (component.hasUnsavedChanges?.()) {
      return confirm("未保存の変更があります。本当に離れますか？");
    }
    return true;
  }
}
```

## Resolve - データの事前取得

```typescript
@Injectable({ providedIn: "root" })
export class UserResolver implements Resolve<User> {
  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    return this.userService.getUser(route.params["id"]);
  }
}
```

ルートガードを適切に使うと、権限ロジックを一元管理でき、各コンポーネントに散らばらせずに済む。
