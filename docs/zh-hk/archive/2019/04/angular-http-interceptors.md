---
title: "Angular HTTP 攔截器：統一處理認證與錯誤"
date: 2019-04-27 10:45:48
tags:
  - Angular
readingTime: 1
description: "HttpInterceptor 是 Angular 中處理跨切關注點（Token 注入、錯誤處理、Loading）的最佳位置。"
wordCount: 64
---

HttpInterceptor 是 Angular 中處理跨切關注點（Token 注入、錯誤處理、Loading）的最佳位置。

## 認證攔截器

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

## 錯誤處理攔截器

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

## 註冊攔截器

```typescript
@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ]
})
```

攔截器鏈按註冊順序執行，`multi: true` 允許多個攔截器共存。