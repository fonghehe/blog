---
title: "Angular 5 组件架构：Smart/Dumb 组件设计模式"
date: 2018-03-28 16:41:01
tags:
  - Angular
---

随着 Angular 应用复杂度提升，如何合理划分组件职责变得越来越重要。Smart/Dumb（也叫 Container/Presentational）组件模式是目前最主流的 Angular 组件设计思路。

## 什么是 Smart/Dumb 组件

**Smart 组件（容器组件）**

- 负责数据获取、状态管理
- 与 Service、Store 交互
- 不关心 UI 细节
- 通过 `@Input` 向子组件传数据，监听子组件 `@Output`

**Dumb 组件（展示组件）**

- 只负责渲染 UI
- 数据全来自 `@Input`
- 通过 `@Output` 向上通知事件
- 可复用、易测试

## 示例：用户列表

**Smart 组件：UserListContainerComponent**

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

**Dumb 组件：UserListComponent**

```typescript
{% raw %}
// user-list.component.ts
@Component({
  selector: "app-user-list",
  template: `
    <div *ngIf="loading">加载中...</div>
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

Dumb 组件使用 `ChangeDetectionStrategy.OnPush` 是标配。由于数据只来自 `@Input`，Angular 只需在输入引用变化时才检测变更，大幅减少不必要的重渲染：

```typescript
// 性能对比（100个列表项场景）
// Default 策略：每次事件循环都检测 = 每秒可能执行数百次检测
// OnPush 策略：仅在 Input 引用变化时检测 = 性能提升 3-5x
```

## 组织目录结构

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

## 何时打破规则

不是每个组件都需要严格分类：

- 页面级路由组件天然是 Smart，不需要再包一层 Container
- 小型应用过度拆分反而增加心智负担
- 共享 UI 库中的组件优先做成 Dumb

## 总结

Smart/Dumb 模式让组件职责清晰，Dumb 组件配合 `OnPush` 还能显著改善性能。这个模式在 Vue 和 React 里同样适用，是跨框架通用的前端架构思想。
