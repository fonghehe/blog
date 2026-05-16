---
title: "Angular 5 Component Architecture: Smart/Dumb Component Design Pattern"
date: 2018-03-28 16:41:01
tags:
  - Angular
readingTime: 2
description: "As Angular applications grow in complexity, properly dividing component responsibilities becomes increasingly important. The Smart/Dumb (also called Container/P"
---

As Angular applications grow in complexity, properly dividing component responsibilities becomes increasingly important. The Smart/Dumb (also called Container/Presentational) component pattern is the most mainstream Angular component design philosophy today.

## What Are Smart/Dumb Components

**Smart Component (Container Component)**

- Responsible for data fetching and state management
- Interacts with Services and Stores
- Doesn't care about UI details
- Passes data to child components via `@Input`, listens to child `@Output`

**Dumb Component (Presentational Component)**

- Only responsible for rendering UI
- All data comes from `@Input`
- Notifies parent of events via `@Output`
- Reusable and easy to test

## Example: User List

**Smart Component: UserListContainerComponent**

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

**Dumb Component: UserListComponent**

```typescript
{% raw %}
// user-list.component.ts
@Component({
  selector: "app-user-list",
  template: `
    <div *ngIf="loading">Loading...</div>
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

## Benefits of OnPush Strategy

Using `ChangeDetectionStrategy.OnPush` on Dumb components is standard practice. Since data only comes from `@Input`, Angular only checks for changes when an input reference changes, dramatically reducing unnecessary re-renders:

```typescript
// Performance comparison (100-item list scenario)
// Default strategy: checks every event loop cycle = hundreds of checks per second
// OnPush strategy: checks only when Input reference changes = 3-5x performance improvement
```

## Organizing the Directory Structure

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

## When to Break the Rules

Not every component needs strict classification:

- Page-level route components are naturally Smart — no need for an extra Container wrapper
- Over-splitting in small apps adds cognitive overhead
- Components in shared UI libraries should prefer being Dumb

## Summary

The Smart/Dumb pattern makes component responsibilities clear, and Dumb components with `OnPush` can significantly improve performance. This pattern works equally well in Vue and React — it's a framework-agnostic frontend architecture principle.
