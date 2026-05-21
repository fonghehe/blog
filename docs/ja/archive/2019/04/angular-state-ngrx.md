---
title: "NgRxによる状態管理：AngularのReduxベストプラクティス"
date: 2019-04-05 10:45:15
tags:
  - Angular
readingTime: 1
description: "NgRxはAngularエコシステムで最も人気の高い状態管理ソリューションであり、ReduxパターンとRxJSをベースにしています。"
wordCount: 103
---

NgRxはAngularエコシステムで最も人気の高い状態管理ソリューションであり、ReduxパターンとRxJSをベースにしています。

## コアコンセプト

**Action**

```typescript
export const loadUsers = createAction("[User] Load Users");
export const loadUsersSuccess = createAction(
  "[User] Load Users Success",
  props<{ users: User[] }>(),
);
```

**Reducer**

```typescript
export const userReducer = createReducer(
  initialState,
  on(loadUsersSuccess, (state, { users }) => ({
    ...state,
    users,
    loading: false,
  })),
);
```

**Effect**

```typescript
@Injectable()
export class UserEffects {
  loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadUsers),
      switchMap(() =>
        this.userService.getUsers().pipe(
          map((users) => loadUsersSuccess({ users })),
          catchError((err) => of(loadUsersFailure({ error: err.message }))),
        ),
      ),
    ),
  );
}
```

**Selector**

```typescript
export const selectUsers = createSelector(
  selectUserState,
  (state) => state.users,
);

// コンポーネントでの使用
this.users$ = this.store.select(selectUsers);
```

NgRxは学習コストが高いですが、大規模なチーム開発プロジェクトではコードの保守性を大幅に向上させます。
