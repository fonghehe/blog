---
title: "Angular HTTP Interceptors: Unified Authentication and Error Handling"
date: 2019-04-27 10:45:48
tags:
  - Angular
readingTime: 1
description: "`HttpInterceptor` is the best place in Angular to handle cross-cutting concerns such as token injection, error handling, and loading states."
wordCount: 44
---

`HttpInterceptor` is the best place in Angular to handle cross-cutting concerns such as token injection, error handling, and loading states.

## Authentication Interceptor

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

## Error Handling Interceptor

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

## Registering Interceptors

```typescript
@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ]
})
```

The interceptor chain executes in the order they are registered. `multi: true` allows multiple interceptors to coexist.
