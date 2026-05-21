---
title: "NgRx State Management: Redux Best Practices for Angular"
date: 2019-04-05 10:45:15
tags:
  - Angular
readingTime: 1
description: "NgRx is the most popular state management solution in the Angular ecosystem, built on the Redux pattern and RxJS."
wordCount: 42
---

NgRx is the most popular state management solution in the Angular ecosystem, built on the Redux pattern and RxJS.

## Core Concepts

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

// Usage in component
this.users$ = this.store.select(selectUsers);
```

NgRx has a steep learning curve, but in large team collaboration projects it significantly improves code maintainability.
