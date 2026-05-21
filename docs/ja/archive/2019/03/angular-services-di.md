---
title: "Angular依存性注入とサービス設計"
date: 2019-03-03 15:35:12
tags:
  - Angular
readingTime: 1
description: "Angularの依存性注入システムはフレームワークのコアだ。これを理解することで、より模块化されテスト可能なコードを書けるようになる。"
wordCount: 140
---

Angularの依存性注入システムはフレームワークのコアだ。これを理解することで、より模块化されテスト可能なコードを書けるようになる。

## サービスの作成

```typescript
@Injectable({
  providedIn: "root", // グローバルシングルトン
})
export class UserService {
  private users: User[] = [];

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>("/api/users");
  }
}
```

## 注入の階層

```typescript
// モジュールレベル - 共有インスタンス
@NgModule({
  providers: [UserService]
})

// コンポーネントレベル - 各コンポーネントが独立したインスタンスを持つ
@Component({
  providers: [UserService]
})
```

## InjectionTokenの使用

```typescript
export const API_URL = new InjectionToken<string>('API_URL');

@NgModule({
  providers: [{ provide: API_URL, useValue: 'https://api.example.com' }]
})

// 注入する
constructor(@Inject(API_URL) private apiUrl: string) {}
```

## テストフレンドリー

DIによりモックが非常に簡単になる：

```typescript
TestBed.configureTestingModule({
  providers: [{ provide: UserService, useValue: { getUsers: () => of([]) } }],
});
```

AngularのDIシステムは、エンタープライズアプリケーションで人気を集めている重要な理由の一つだ。
