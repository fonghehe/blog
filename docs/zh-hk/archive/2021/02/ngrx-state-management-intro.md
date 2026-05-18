---
title: "NgRx 入門：Angular 應用的響應式狀態管理"
date: 2021-02-27 11:00:03
tags:
  - Angular
  - TypeScript
readingTime: 2
description: "NgRx 是 Angular 生態最主流的狀態管理庫，基於 Redux 模式 + RxJS。對於中大型 Angular 應用，NgRx 能讓狀態流轉變得可預測、可調試、可測試。這篇文章帶你完整走一遍 NgRx 的核心概念和實際用法。"
---

NgRx 是 Angular 生態最主流的狀態管理庫，基於 Redux 模式 + RxJS。對於中大型 Angular 應用，NgRx 能讓狀態流轉變得可預測、可調試、可測試。這篇文章帶你完整走一遍 NgRx 的核心概念和實際用法。

## 核心概念

```
Store（單一狀態樹）
  ↑ 讀取               ↓ 分發
Component  ——dispatch(Action)——→  Reducer（純函數）→ 新 State
  ↑ select               ↑
  └──────── Effect（副作用：HTTP 請求等）
```

## 安裝

```bash
ng add @ngrx/store @ngrx/effects @ngrx/entity @ngrx/store-devtools
```

## 定義 State、Action、Reducer

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

// Entity Adapter（自動管理 ids + entities 結構）
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

## Effects（處理副作用）

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

## 在組件中使用

```typescript
@Component({
  template: `
    <div *ngIf="loading$ | async">加載中...</div>
    <div *ngIf="error$ | async as error" class="error">{{ error }}</div>
    <ul>
      <li *ngFor="let user of users$ | async">
        {{ user.name }}
        <button (click)="onDelete(user.id)">刪除</button>
      </li>
    </ul>
    <button (click)="onLoad()">加載用户</button>
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

## 註冊到 AppModule

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

## 何時選擇 NgRx

**適合**：

- 多個不相關組件共享狀態
- 需要時間旅行調試（Redux DevTools）
- 複雜異步流程（多個 API 依賴、樂觀更新）

**不適合**：

- 小型應用（用 BehaviorSubject + Service 就夠了）
- 簡單的父子組件通信（用 @Input/@Output）

## 總結

NgRx 的學習曲線較陡，但一旦理解了 Action → Reducer → Store → Selector → Effect 這條鏈路，調試和測試狀態邏輯會變得非常順手。NgRx DevTools 的時間旅行調試是企業級應用排查 bug 的利器。
