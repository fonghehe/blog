---
title: "Angular 5 元件架構：Smart/Dumb 元件設計模式"
date: 2018-03-28 16:41:01
tags:
  - Angular
readingTime: 2
description: "隨著 Angular 應用複雜度提升，如何合理劃分元件職責變得越來越重要。Smart/Dumb（也叫 Container/Presentational）元件模式是目前最主流的 Angular 元件設計思路。"
wordCount: 333
---

隨著 Angular 應用複雜度提升，如何合理劃分元件職責變得越來越重要。Smart/Dumb（也叫 Container/Presentational）元件模式是目前最主流的 Angular 元件設計思路。

## 什麼是 Smart/Dumb 元件

**Smart 元件（容器元件）**

- 負責資料獲取、狀態管理
- 與 Service、Store 互動
- 不關心 UI 細節
- 通過 `@Input` 向子元件傳資料，監聽子元件 `@Output`

**Dumb 元件（展示元件）**

- 只負責渲染 UI
- 資料全來自 `@Input`
- 通過 `@Output` 向上通知事件
- 可複用、易測試

## 示例：使用者列表

**Smart 元件：UserListContainerComponent**

```typescript
// user-list-container.component.ts
@Component({
  selector: "app-user-list-container",
  template: `
    <app-user-list
      [users]="users$ | async"
      [loading]="loading$ | async"
      (deleteUser)="onDeleteUser($event)"
    ></app-user-list>
  `,
})
export class UserListContainerComponent implements OnInit {
  users$: Observable<User[]>;
  loading$: Observable<boolean>;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.users$ = this.userService.getUsers();
    this.loading$ = this.userService.loading$;
  }

  onDeleteUser(userId: number) {
    this.userService.deleteUser(userId).subscribe();
  }
}
```

**Dumb 元件：UserListComponent**

```typescript
{% raw %}
// user-list.component.ts
@Component({
  selector: "app-user-list",
  template: `
    <div *ngIf="loading">載入中...</div>
    <ul *ngIf="!loading">
      <li *ngFor="let user of users" (click)="deleteUser.emit(user.id)">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent {
  @Input() users: User[];
  @Input() loading: boolean;
  @Output() deleteUser = new EventEmitter<number>();
}
{% endraw %}
```

## OnPush 策略的收益

Dumb 元件使用 `ChangeDetectionStrategy.OnPush` 是標配。由於資料只來自 `@Input`，Angular 只需在輸入引用變化時才檢測變更，大幅減少不必要的重渲染：

```typescript
// 效能對比（100個列表項場景）
// Default 策略：每次事件迴圈都檢測 = 每秒可能執行數百次檢測
// OnPush 策略：僅在 Input 引用變化時檢測 = 效能提升 3-5x
```

## 組織目錄結構

```
src/app/users/
├── containers/
│   └── user-list-container/     # Smart
│       ├── user-list-container.component.ts
│       └── user-list-container.component.spec.ts
├── components/
│   ├── user-list/               # Dumb
│   └── user-card/               # Dumb
├── services/
│   └── user.service.ts
└── users.module.ts
```

## 何時打破規則

不是每個元件都需要嚴格分類：

- 頁面級路由元件天然是 Smart，不需要再包一層 Container
- 小型應用過度拆分反而增加心智負擔
- 共享 UI 庫中的元件優先做成 Dumb

## 總結

Smart/Dumb 模式讓元件職責清晰，Dumb 元件配合 `OnPush` 還能顯著改善效能。這個模式在 Vue 和 React 裡同樣適用，是跨框架通用的前端架構思想。
