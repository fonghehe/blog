---
title: "NgRx 入门：Angular 应用的响应式状态管理"
date: 2021-02-27 11:00:03
tags:
  - Angular
  - TypeScript
---

NgRx 是 Angular 生态最主流的状态管理库，基于 Redux 模式 + RxJS。对于中大型 Angular 应用，NgRx 能让状态流转变得可预测、可调试、可测试。这篇文章带你完整走一遍 NgRx 的核心概念和实际用法。

## 核心概念

```
Store（单一状态树）
  ↑ 读取               ↓ 分发
Component  ——dispatch(Action)——→  Reducer（纯函数）→ 新 State
  ↑ select               ↑
  └──────── Effect（副作用：HTTP 请求等）
```

## 安装

```bash
ng add @ngrx/store @ngrx/effects @ngrx/entity @ngrx/store-devtools
```

## 定义 State、Action、Reducer

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

## Effects（处理副作用）

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

## 在组件中使用

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

## 注册到 AppModule

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

## 何时选择 NgRx

**适合**：

- 多个不相关组件共享状态
- 需要时间旅行调试（Redux DevTools）
- 复杂异步流程（多个 API 依赖、乐观更新）

**不适合**：

- 小型应用（用 BehaviorSubject + Service 就够了）
- 简单的父子组件通信（用 @Input/@Output）

## 总结

NgRx 的学习曲线较陡，但一旦理解了 Action → Reducer → Store → Selector → Effect 这条链路，调试和测试状态逻辑会变得非常顺手。NgRx DevTools 的时间旅行调试是企业级应用排查 bug 的利器。
