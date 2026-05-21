---
title: "Angular 依賴注入與服務設計"
date: 2019-03-03 15:35:12
tags:
  - Angular
readingTime: 1
description: "Angular 的依賴注入系統是框架的核心，理解它能讓你寫出更模組化、可測試的程式碼。"
wordCount: 80
---

Angular 的依賴注入系統是框架的核心，理解它能讓你寫出更模組化、可測試的程式碼。

## 建立服務

```typescript
@Injectable({
  providedIn: 'root'  // 全域性單例
})
export class UserService {
  private users: User[] = [];

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }
}
```

## 注入層級

```typescript
// 模組級別 - 共享例項
@NgModule({
  providers: [UserService]
})

// 元件級別 - 每個元件獨立例項
@Component({
  providers: [UserService]
})
```

## 使用 InjectionToken

```typescript
export const API_URL = new InjectionToken<string>('API_URL');

@NgModule({
  providers: [{ provide: API_URL, useValue: 'https://api.example.com' }]
})

// 注入
constructor(@Inject(API_URL) private apiUrl: string) {}
```

## 測試友好

DI 讓 mock 變得非常簡單：

```typescript
TestBed.configureTestingModule({
  providers: [
    { provide: UserService, useValue: { getUsers: () => of([]) } }
  ]
});
```

Angular DI 系統是其在企業應用中受歡迎的重要原因。