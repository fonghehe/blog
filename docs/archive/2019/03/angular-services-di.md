---
title: "Angular 依赖注入与服务设计"
date: 2019-03-03 15:35:12
tags:
  - Angular
---

Angular 的依赖注入系统是框架的核心，理解它能让你写出更模块化、可测试的代码。

## 创建服务

```typescript
@Injectable({
  providedIn: 'root'  // 全局单例
})
export class UserService {
  private users: User[] = [];

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }
}
```

## 注入层级

```typescript
// 模块级别 - 共享实例
@NgModule({
  providers: [UserService]
})

// 组件级别 - 每个组件独立实例
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

## 测试友好

DI 让 mock 变得非常简单：

```typescript
TestBed.configureTestingModule({
  providers: [
    { provide: UserService, useValue: { getUsers: () => of([]) } }
  ]
});
```

Angular DI 系统是其在企业应用中受欢迎的重要原因。