---
title: "NgRx 状态管理：Angular 的 Redux 最佳实践"
date: 2019-04-05 10:45:15
tags:
  - Angular
readingTime: 1
description: "NgRx 是 Angular 生态中最流行的状态管理方案，基于 Redux 模式与 RxJS。"
---

NgRx 是 Angular 生态中最流行的状态管理方案，基于 Redux 模式与 RxJS。

## 核心概念

**Action**

```typescript
export const loadUsers = createAction('[User] Load Users');
export const loadUsersSuccess = createAction(
  '[User] Load Users Success',
  props<{ users: User[] }>()
);
```

**Reducer**

```typescript
export const userReducer = createReducer(
  initialState,
  on(loadUsersSuccess, (state, { users }) => ({ ...state, users, loading: false }))
);
```

**Effect**

```typescript
@Injectable()
export class UserEffects {
  loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadUsers),
      switchMap(() => this.userService.getUsers().pipe(
        map(users => loadUsersSuccess({ users })),
        catchError(err => of(loadUsersFailure({ error: err.message })))
      ))
    )
  );
}
```

**Selector**

```typescript
export const selectUsers = createSelector(
  selectUserState,
  (state) => state.users
);

// 组件中使用
this.users$ = this.store.select(selectUsers);
```

NgRx 的学习曲线较高，但在大型团队协作项目中能显著提升代码可维护性。