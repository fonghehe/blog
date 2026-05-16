---
title: "Angular Route Guards: Best Practices for Permission Control"
date: 2019-03-13 15:35:38
tags:
  - Angular
readingTime: 1
description: "Angular Router provides multiple guard interfaces for fine-grained control over route access permissions."
---

Angular Router provides multiple guard interfaces for fine-grained control over route access permissions.

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

Route configuration:

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

Prevent users from accidentally leaving a form with unsaved changes:

```typescript
@Injectable({ providedIn: "root" })
export class UnsavedChangesGuard implements CanDeactivate<unknown> {
  canDeactivate(component: any): boolean {
    if (component.hasUnsavedChanges?.()) {
      return confirm(
        "You have unsaved changes. Are you sure you want to leave?",
      );
    }
    return true;
  }
}
```

## Resolve - Prefetch Data

```typescript
@Injectable({ providedIn: "root" })
export class UserResolver implements Resolve<User> {
  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    return this.userService.getUser(route.params["id"]);
  }
}
```

Using route guards thoughtfully centralizes permission logic and keeps it out of individual components.
