---
title: "Angular Dependency Injection and Service Design"
date: 2019-03-03 15:35:12
tags:
  - Angular
readingTime: 1
description: "Angular's dependency injection system is at the core of the framework. Understanding it enables you to write more modular, testable code."
wordCount: 48
---

Angular's dependency injection system is at the core of the framework. Understanding it enables you to write more modular, testable code.

## Creating a Service

```typescript
@Injectable({
  providedIn: "root", // global singleton
})
export class UserService {
  private users: User[] = [];

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>("/api/users");
  }
}
```

## Injection Hierarchy

```typescript
// Module level - shared instance
@NgModule({
  providers: [UserService]
})

// Component level - each component gets its own instance
@Component({
  providers: [UserService]
})
```

## Using InjectionToken

```typescript
export const API_URL = new InjectionToken<string>('API_URL');

@NgModule({
  providers: [{ provide: API_URL, useValue: 'https://api.example.com' }]
})

// Inject it
constructor(@Inject(API_URL) private apiUrl: string) {}
```

## Testing-Friendly

DI makes mocking straightforward:

```typescript
TestBed.configureTestingModule({
  providers: [{ provide: UserService, useValue: { getUsers: () => of([]) } }],
});
```

Angular's DI system is one of the key reasons it is popular in enterprise applications.
