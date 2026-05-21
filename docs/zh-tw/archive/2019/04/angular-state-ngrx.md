---
title: "NgRx 狀態管理：Angular 的 Redux 最佳實踐"
date: 2019-04-05 10:45:15
tags:
  - Angular
readingTime: 1
description: "NgRx 是 Angular 生態中最流行的狀態管理方案，基於 Redux 模式與 RxJS。"
wordCount: 64
---

NgRx 是 Angular 生態中最流行的狀態管理方案，基於 Redux 模式與 RxJS。

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

// 元件中使用
this.users$ = this.store.select(selectUsers);
```

NgRx 的學習曲線較高，但在大型團隊協作專案中能顯著提升程式碼可維護性。