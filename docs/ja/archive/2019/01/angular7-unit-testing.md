---
title: "Angular 7 ユニットテスト実践：Jasmine + Karma 完全ガイド"
date: 2019-01-26 11:18:43
tags:
  - Angular
readingTime: 1
description: "Angular CLIでプロジェクトを生成すると、デフォルトでJasmine + Karmaのテスト環境が設定される。テストをスキップする開発者が多いが、Angularのテストツールチェーンはアプリケーションコードとよく統合されている。"
wordCount: 134
---

Angular CLIでプロジェクトを生成すると、デフォルトでJasmine + Karmaのテスト環境が設定される。テストをスキップする開発者が多いが、Angularのテストツールチェーンはアプリケーションコードとよく統合されている。

## コンポーネントのテスト：TestBedの基礎

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

  it("ユーザー名を表示すること", () => {
    component.user = { name: "Alice", email: "alice@example.com" };
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector(".user-name").textContent).toContain("Alice");
  });

  it("削除ボタンをクリックするとdeleteUserイベントが発火すること", () => {
    component.user = { name: "Bob", id: 1 };
    fixture.detectChanges();
    let emittedId: number;
    component.deleteUser.subscribe((id) => (emittedId = id));
    fixture.nativeElement.querySelector(".delete-btn").click();
    expect(emittedId).toBe(1);
  });
});
```

## サービスのテスト：依存関係のモック注入

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

  afterEach(() => httpMock.verify()); // 未処理のリクエストがないことを確認

  it("ユーザーリストを正しく返すこと", () => {
    const mockUsers = [{ id: 1, name: "Alice" }];

    service.getUsers().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });

    const req = httpMock.expectOne("/api/users");
    expect(req.request.method).toBe("GET");
    req.flush(mockUsers); // モックデータを返す
  });

  it("HTTP 500エラーを処理すること", () => {
    service.getUsers().subscribe({
      error: (err) => expect(err.status).toBe(500),
    });
    const req = httpMock.expectOne("/api/users");
    req.flush("Server Error", { status: 500, statusText: "Error" });
  });
});
```

## Routerを含むコンポーネントのテスト

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
