---
title: "Angular HTTP 拦截器：统一处理认证与错误"
date: 2019-04-27 10:45:48
tags:
  - Angular
readingTime: 1
description: "HttpInterceptor 是 Angular 中处理跨切关注点（Token 注入、错误处理、Loading）的最佳位置。"
---

HttpInterceptor 是 Angular 中处理跨切关注点（Token 注入、错误处理、Loading）的最佳位置。

## 认证拦截器

```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    if (!token) return next.handle(req);

    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next.handle(authReq);
  }
}
```

## 错误处理拦截器

```typescript
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}
```

## 注册拦截器

```typescript
@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ]
})
```

拦截器链按注册顺序执行，`multi: true` 允许多个拦截器共存。