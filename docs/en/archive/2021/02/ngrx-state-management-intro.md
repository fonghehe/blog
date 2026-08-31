---
title: "NgRx Intro: Reactive State Management for Angular Apps"
date: 2021-02-27 11:00:03
tags:
  - Angular
  - TypeScript

readingTime: 2
description: "NgRx is the most mainstream state-management library in the Angular ecosystem, built on the Redux pattern plus RxJS. For medium-to-large Angular apps, NgRx makes state transitions predictable, debuggable, and testable. This article walks you through NgRx's core concepts and real usage end to end."
wordCount: 154
---

NgRx is the most popular state-management library in the Angular ecosystem, built on the Redux pattern + RxJS. For medium-to-large Angular apps, NgRx makes state flow predictable, debuggable, and testable. This article walks you through NgRx's core concepts and real-world usage from start to finish.

## Core Concepts

```
Store（单一状态树）
  ↑ 读取               ↓ 分发
Component  ——dispatch(Action)——→  Reducer（纯函数）→ 新 State
  ↑ select               ↑
  └──────── Effect（副作用：HTTP 请求等）
```

## Installation

```bash
ng add @ngrx/store @ngrx/effects @ngrx/entity @ngrx/store-devtools
```

## Defining State, Actions, and Reducers

```typescript
// users/users.state.ts
import { createReducer, createAction, on, props } from "@ngrx/store";
import { createEntityAdapter, EntityState } from "@ngrx/entity";

export interface User {
  id: number;
  name: string;
  email: string;
}

// Actions
export const loadUsers = createAction("[Users] Load Users");
export const loadUsersSuccess = createAction(
  "[Users] Load Users Success",
  props<{ users: User[] }>(),
);
export const loadUsersFailure = createAction(
  "[Users] Load Users Failure",
  props<{ error: string }>(),
);
export const deleteUser = createAction(
  "[Users] Delete User",
  props<{ id: number }>(),
);

// Entity Adapter（自动管理 ids + entities 结构）
export const adapter = createEntityAdapter<User>();

export interface UsersState extends EntityState<User> {
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = adapter.getInitialState({
  loading: false,
  error: null,
});

// Reducer
export const usersReducer = createReducer(
  initialState,
  on(loadUsers, (state) => ({ ...state, loading: true, error: null })),
  on(loadUsersSuccess, (state, { users }) =>
    adapter.setAll(users, { ...state, loading: false }),
  ),
  on(loadUsersFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(deleteUser, (state, { id }) => adapter.removeOne(id, state)),
);
```

## Selectors

```typescript
// users/users.selectors.ts
import { createFeatureSelector, createSelector } from "@ngrx/store";

const selectUsersFeature = createFeatureSelector<UsersState>("users");

const { selectAll, selectEntities, selectTotal } = adapter.getSelectors();

export const selectAllUsers = createSelector(selectUsersFeature, selectAll);
export const selectUsersLoading = createSelector(
  selectUsersFeature,
  (s) => s.loading,
);
export const selectUsersError = createSelector(
  selectUsersFeature,
  (s) => s.error,
);

// 派生 selector
export const selectActiveUsers = createSelector(selectAllUsers, (users) =>
  users.filter((u) => u.active),
);
```

## Effects (Handling Side Effects)

```typescript
// users/users.effects.ts
import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { of } from "rxjs";
import { map, exhaustMap, catchError } from "rxjs/operators";

@Injectable()
export class UsersEffects {
  loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadUsers),
      exhaustMap(() =>
        this.userService.getUsers().pipe(
          map((users) => loadUsersSuccess({ users })),
          catchError((err) => of(loadUsersFailure({ error: err.message }))),
        ),
      ),
    ),
  );

  constructor(
    private actions$: Actions,
    private userService: UserService,
  ) {}
}
```

## Using in Components

```typescript
@Component({
  template: `
    <div *ngIf="loading$ | async">加载中...</div>
    <div *ngIf="error$ | async as error" class="error">{{ error }}</div>
    <ul>
      <li *ngFor="let user of users$ | async">
        {{ user.name }}
        <button (click)="onDelete(user.id)">删除</button>
      </li>
    </ul>
    <button (click)="onLoad()">加载用户</button>
  `,
})
export class UsersComponent {
  users$ = this.store.select(selectAllUsers);
  loading$ = this.store.select(selectUsersLoading);
  error$ = this.store.select(selectUsersError);

  constructor(private store: Store) {}

  onLoad() {
    this.store.dispatch(loadUsers());
  }

  onDelete(id: number) {
    this.store.dispatch(deleteUser({ id }));
  }
}
```

## Registering with AppModule

```typescript
@NgModule({
  imports: [
    StoreModule.forRoot({ users: usersReducer }),
    EffectsModule.forRoot([UsersEffects]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
    }),
  ],
})
export class AppModule {}
```

## When to Choose NgRx

**Good fit:**

- Multiple unrelated components share state.
- You need time-travel debugging (Redux DevTools).
- Complex async flows (multiple dependent API calls, optimistic updates).

**Not a good fit:**

- Small apps (a BehaviorSubject + Service is enough).
- Simple parent-child component communication (use @Input/@Output).

## Summary

NgRx has a steep learning curve, but once you understand the Action → Reducer → Store → Selector → Effect pipeline, debugging and testing your state logic becomes very straightforward. NgRx DevTools' time-travel debugging is a powerful tool for tracking down bugs in enterprise-scale applications.
