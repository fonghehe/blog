---
title: "NgRx 15：Standalone API 支援與訊號商店前瞻"
date: 2023-01-20 17:22:49
tags:
  - 前端
readingTime: 2
description: "NgRx 15 隨 Angular 15 同步釋出，帶來了對 Standalone APIs 的全面支援。不再需要在 `NgModule` 裡註冊 `StoreModule`、`EffectsModule`——現在可以在 `bootstrapApplication` 中用函式式 API 配置整個 NgRx 棧。"
wordCount: 186
---

NgRx 15 隨 Angular 15 同步釋出，帶來了對 Standalone APIs 的全面支援。不再需要在 `NgModule` 裡註冊 `StoreModule`、`EffectsModule`——現在可以在 `bootstrapApplication` 中用函式式 API 配置整個 NgRx 棧。

## 新的函式式配置 API

```typescript
// main.ts（Angular 15 + NgRx 15，無 AppModule）
import { bootstrapApplication } from "@angular/platform-browser";
import { provideStore } from "@ngrx/store";
import { provideEffects } from "@ngrx/effects";
import { provideRouterStore } from "@ngrx/router-store";
import { provideStoreDevtools } from "@ngrx/store-devtools";
import { AppComponent } from "./app/app.component";
import { reducers, metaReducers } from "./store";
import { UserEffects } from "./store/user.effects";
import { ProductEffects } from "./store/product.effects";

bootstrapApplication(AppComponent, {
  providers: [
    provideStore(reducers, { metaReducers }),
    provideEffects(UserEffects, ProductEffects),
    provideRouterStore(),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
    }),
  ],
});
```

對比舊的 NgModule 方式：

```typescript
// 舊方式（NgRx 14 及之前）
@NgModule({
  imports: [
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot([UserEffects, ProductEffects]),
    RouterStoreModule,
    StoreDevtoolsModule.instrument({ maxAge: 25 }),
  ],
})
export class AppModule {}
```

## Feature Store 懶載入

```typescript
// 功能路由中懶載入 feature store
export const ORDERS_ROUTES: Routes = [
  {
    path: "",
    providers: [
      provideState(ordersFeature), // feature reducer
      provideEffects(OrdersEffects), // feature effects
    ],
    component: OrdersShellComponent,
    children: [
      { path: "", component: OrderListComponent },
      { path: ":id", component: OrderDetailComponent },
    ],
  },
];
```

## createFeature 簡化 Feature Store

NgRx 15 中 `createFeature` 更加完善，自動生成所有 selectors：

```typescript
// store/orders.feature.ts
import { createFeature, createReducer, on } from "@ngrx/store";
import { OrdersActions } from "./orders.actions";

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
}

const initialState: OrdersState = {
  orders: [],
  loading: false,
  error: null,
  selectedId: null,
};

export const ordersFeature = createFeature({
  name: "orders",
  reducer: createReducer(
    initialState,
    on(OrdersActions.loadOrders, (state) => ({ ...state, loading: true })),
    on(OrdersActions.loadOrdersSuccess, (state, { orders }) => ({
      ...state,
      orders,
      loading: false,
    })),
    on(OrdersActions.loadOrdersFailure, (state, { error }) => ({
      ...state,
      error,
      loading: false,
    })),
    on(OrdersActions.selectOrder, (state, { id }) => ({
      ...state,
      selectedId: id,
    })),
  ),
  // extraSelectors 擴充套件派生 selectors
  extraSelectors: ({ selectOrders, selectSelectedId }) => ({
    selectSelectedOrder: createSelector(
      selectOrders,
      selectSelectedId,
      (orders, id) => orders.find((o) => o.id === id) ?? null,
    ),
    selectOrderCount: createSelector(selectOrders, (orders) => orders.length),
  }),
});

// createFeature 自動生成：
// selectOrdersState, selectOrders, selectLoading, selectError,
// selectSelectedId, selectSelectedOrder, selectOrderCount
export const {
  selectOrdersState,
  selectOrders,
  selectLoading,
  selectSelectedOrder,
  selectOrderCount,
} = ordersFeature;
```

## 函式式 Effects

NgRx 15 引入了函式式 effects，類似 Angular 14 的函式式 guards：

```typescript
// 傳統 class Effects
@Injectable()
export class UserEffects {
  loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUsers),
      switchMap(() =>
        this.userService.getAll().pipe(
          map((users) => UserActions.loadUsersSuccess({ users })),
          catchError((error) =>
            of(UserActions.loadUsersFailure({ error: error.message })),
          ),
        ),
      ),
    ),
  );
  constructor(
    private actions$: Actions,
    private userService: UserService,
  ) {}
}

// NgRx 15 函式式 effect（實驗性）
const loadUsers$ = createEffect(
  (actions$ = inject(Actions), userService = inject(UserService)) =>
    actions$.pipe(
      ofType(UserActions.loadUsers),
      switchMap(() =>
        userService.getAll().pipe(
          map((users) => UserActions.loadUsersSuccess({ users })),
          catchError((error) =>
            of(UserActions.loadUsersFailure({ error: error.message })),
          ),
        ),
      ),
    ),
);
```

## 總結

NgRx 15 對 Standalone APIs 的支援讓 Angular 狀態管理的配置更簡潔，與 Angular 15 的方向完全對齊。`createFeature` 的 `extraSelectors` 消除了大量 selector 模板程式碼。對於新專案，直接使用 `provideStore` + `createFeature` 的組合是當前最佳實踐。