---
title: "Angular 7 單元測試實踐：Jasmine + Karma 完整指南"
date: 2019-01-26 11:18:43
tags:
  - Angular
readingTime: 2
description: "Angular CLI 生成項目時默認配好了 Jasmine + Karma 測試環境。很多人跳過了測試，其實 Angular 的測試工具鏈與業務代碼結合得非常居家。"
wordCount: 138
---

Angular CLI 生成項目時默認配好了 Jasmine + Karma 測試環境。很多人跳過了測試，其實 Angular 的測試工具鏈與業務代碼結合得非常居家。

## 測試組件：TestBed 基礎

```typescript
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UserCardComponent } from "./user-card.component";

describe("UserCardComponent", () => {
  let component: UserCardComponent;
  let fixture: ComponentFixture<UserCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    component = fixture.componentInstance;
  });

  it("應展示用户名稱", () => {
    component.user = { name: "Alice", email: "alice@example.com" };
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector(".user-name").textContent).toContain("Alice");
  });

  it("點擊刪除按鈕應觸發 deleteUser 事件", () => {
    component.user = { name: "Bob", id: 1 };
    fixture.detectChanges();
    let emittedId: number;
    component.deleteUser.subscribe((id) => (emittedId = id));
    fixture.nativeElement.querySelector(".delete-btn").click();
    expect(emittedId).toBe(1);
  });
});
```

## 測試 Service：注入依賴 Mock

```typescript
describe("UserService", () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify()); // 確保沒有未處理的請求

  it("應正確返回用户列表", () => {
    const mockUsers = [{ id: 1, name: "Alice" }];

    service.getUsers().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });

    const req = httpMock.expectOne("/api/users");
    expect(req.request.method).toBe("GET");
    req.flush(mockUsers); // 返回模擬數據
  });

  it("應處理 HTTP 500 錯誤", () => {
    service.getUsers().subscribe({
      error: (err) => expect(err.status).toBe(500),
    });
    const req = httpMock.expectOne("/api/users");
    req.flush("Server Error", { status: 500, statusText: "Error" });
  });
});
```

## 測試含有 Router 的組件

```typescript
import { RouterTestingModule } from "@angular/router/testing";

describe("NavComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NavComponent],
      imports: [
        RouterTestingModule.withRoutes([
          { path: "users", component: UserListComponent },
        ]),
      ],
    }).compileComponents();
  });

  it("應包含 users 鏈接", () => {
    const fixture = TestBed.createComponent(NavComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll("a[routerLink]");
    expect(links.length).toBeGreaterThan(0);
  });
});
```

## Spy 模擬第三方依賴

```typescript
it("應在成功後跳轉到列表頁", () => {
  const router = TestBed.inject(Router);
  const navigateSpy = spyOn(router, "navigate");
  const userService = TestBed.inject(UserService);
  spyOn(userService, "createUser").and.returnValue(of({ id: 1 }));

  component.form.setValue({ name: "Alice", email: "alice@test.com" });
  component.onSubmit();

  expect(navigateSpy).toHaveBeenCalledWith(["/users"]);
});
```

## 測試覆蓋率命令

```bash
ng test --code-coverage
# 生成 coverage/ 目錄，用瀏覽器打開 coverage/index.html 查看詳細報告
```

## 總結

Angular 的測試工具鏈設計就是為了讓依賴注入和單元測試自然配合。`HttpClientTestingModule` + `RouterTestingModule` + `SpyOn` 三個工具能解決給大多數測試場景。
