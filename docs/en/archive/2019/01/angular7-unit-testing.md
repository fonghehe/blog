---
title: "Angular 7 Unit Testing in Practice: A Complete Guide to Jasmine + Karma"
date: 2019-01-26 11:18:43
tags:
  - Angular
readingTime: 1
description: "When you generate a project with the Angular CLI, it sets up a Jasmine + Karma testing environment by default. Many developers skip testing, but Angular's testi"
---

When you generate a project with the Angular CLI, it sets up a Jasmine + Karma testing environment by default. Many developers skip testing, but Angular's testing toolchain integrates naturally with application code.

## Testing Components: TestBed Basics

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

  it("should display the user name", () => {
    component.user = { name: "Alice", email: "alice@example.com" };
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector(".user-name").textContent).toContain("Alice");
  });

  it("should emit deleteUser event when delete button is clicked", () => {
    component.user = { name: "Bob", id: 1 };
    fixture.detectChanges();
    let emittedId: number;
    component.deleteUser.subscribe((id) => (emittedId = id));
    fixture.nativeElement.querySelector(".delete-btn").click();
    expect(emittedId).toBe(1);
  });
});
```

## Testing Services: Injecting Dependency Mocks

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

  afterEach(() => httpMock.verify()); // ensure no unhandled requests

  it("should return a user list correctly", () => {
    const mockUsers = [{ id: 1, name: "Alice" }];

    service.getUsers().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });

    const req = httpMock.expectOne("/api/users");
    expect(req.request.method).toBe("GET");
    req.flush(mockUsers); // return mock data
  });

  it("should handle HTTP 500 errors", () => {
    service.getUsers().subscribe({
      error: (err) => expect(err.status).toBe(500),
    });
    const req = httpMock.expectOne("/api/users");
    req.flush("Server Error", { status: 500, statusText: "Error" });
  });
});
```

## Testing Components with Router

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
```
