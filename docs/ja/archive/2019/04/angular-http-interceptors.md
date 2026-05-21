---
title: "Angular HTTPインターセプター：認証とエラー処理の一元管理"
date: 2019-04-27 10:45:48
tags:
  - Angular
readingTime: 1
description: "`HttpInterceptor`は、トークン注入・エラー処理・ローディング状態などの横断的関心事を処理するAngularの最適な場所です。"
wordCount: 135
---

`HttpInterceptor`は、トークン注入・エラー処理・ローディング状態などの横断的関心事を処理するAngularの最適な場所です。

## 認証インターセプター

```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    if (!token) return next.handle(req);

    const authReq = req.clone({
      headers: req.headers.set("Authorization", `Bearer ${token}`),
    });
    return next.handle(authReq);
  }
}
```

## エラーハンドリングインターセプター

```typescript
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.router.navigate(["/login"]);
        }
        return throwError(() => error);
      }),
    );
  }
}
```

## インターセプターの登録

```typescript
@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ]
})
```

インターセプターチェーンは登録順に実行されます。`multi: true`により複数のインターセプターを共存させることができます。
