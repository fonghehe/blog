---
title: "Angular 7 单元测试实践：Jasmine + Karma 完整指南"
date: 2019-01-26 11:18:43
tags:
  - Angular
---

Angular CLI 生成项目时默认配好了 Jasmine + Karma 测试环境。很多人跳过了测试，其实 Angular 的测试工具链与业务代码结合得非常居家。

## 测试组件：TestBed 基础

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

  it("应展示用户名称", () => {
    component.user = { name: "Alice", email: "alice@example.com" };
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector(".user-name").textContent).toContain("Alice");
  });

  it("点击删除按钮应触发 deleteUser 事件", () => {
    component.user = { name: "Bob", id: 1 };
    fixture.detectChanges();
    let emittedId: number;
    component.deleteUser.subscribe((id) => (emittedId = id));
    fixture.nativeElement.querySelector(".delete-btn").click();
    expect(emittedId).toBe(1);
  });
});
```

## 测试 Service：注入依赖 Mock

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

  afterEach(() => httpMock.verify()); // 确保没有未处理的请求

  it("应正确返回用户列表", () => {
    const mockUsers = [{ id: 1, name: "Alice" }];

    service.getUsers().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });

    const req = httpMock.expectOne("/api/users");
    expect(req.request.method).toBe("GET");
    req.flush(mockUsers); // 返回模拟数据
  });

  it("应处理 HTTP 500 错误", () => {
    service.getUsers().subscribe({
      error: (err) => expect(err.status).toBe(500),
    });
    const req = httpMock.expectOne("/api/users");
    req.flush("Server Error", { status: 500, statusText: "Error" });
  });
});
```

## 测试含有 Router 的组件

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

  it("应包含 users 链接", () => {
    const fixture = TestBed.createComponent(NavComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll("a[routerLink]");
    expect(links.length).toBeGreaterThan(0);
  });
});
```

## Spy 模拟第三方依赖

```typescript
it("应在成功后跳转到列表页", () => {
  const router = TestBed.inject(Router);
  const navigateSpy = spyOn(router, "navigate");
  const userService = TestBed.inject(UserService);
  spyOn(userService, "createUser").and.returnValue(of({ id: 1 }));

  component.form.setValue({ name: "Alice", email: "alice@test.com" });
  component.onSubmit();

  expect(navigateSpy).toHaveBeenCalledWith(["/users"]);
});
```

## 测试覆盖率命令

```bash
ng test --code-coverage
# 生成 coverage/ 目录，用浏览器打开 coverage/index.html 查看详细报告
```

## 总结

Angular 的测试工具链设计就是为了让依赖注入和单元测试自然配合。`HttpClientTestingModule` + `RouterTestingModule` + `SpyOn` 三个工具能解决给大多数测试场景。
