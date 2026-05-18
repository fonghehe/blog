---
title: "NgRx 15：Standalone API 支持与信号商店前瞻"
date: 2023-01-20 17:22:49
tags:
  - 前端
readingTime: 2
description: "NgRx 15 随 Angular 15 同步发布，带来了对 Standalone APIs 的全面支持。不再需要在 `NgModule` 里注册 `StoreModule`、`EffectsModule`——现在可以在 `bootstrapApplication` 中用函数式 API 配置整个 NgRx 栈。"
---

NgRx 15 随 Angular 15 同步发布，带来了对 Standalone APIs 的全面支持。不再需要在 `NgModule` 里注册 `StoreModule`、`EffectsModule`——现在可以在 `bootstrapApplication` 中用函数式 API 配置整个 NgRx 栈。

## 新的函数式配置 API

```typescript
// main.ts（Angular 15 + NgRx 15，无 AppModule）
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

对比旧的 NgModule 方式：

```typescript
// 旧方式（NgRx 14 及之前）
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

## Feature Store 懒加载

```typescript
// 功能路由中懒加载 feature store
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

## createFeature 简化 Feature Store

NgRx 15 中 `createFeature` 更加完善，自动生成所有 selectors：

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
  // extraSelectors 扩展派生 selectors
  extraSelectors: ({ selectOrders, selectSelectedId }) => ({
    selectSelectedOrder: createSelector(
      selectOrders,
      selectSelectedId,
      (orders, id) => orders.find((o) => o.id === id) ?? null,
    ),
    selectOrderCount: createSelector(selectOrders, (orders) => orders.length),
  }),
});

// createFeature 自动生成：
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

## 函数式 Effects

NgRx 15 引入了函数式 effects，类似 Angular 14 的函数式 guards：

```typescript
// 传统 class Effects
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

// NgRx 15 函数式 effect（实验性）
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

## 总结

NgRx 15 对 Standalone APIs 的支持让 Angular 状态管理的配置更简洁，与 Angular 15 的方向完全对齐。`createFeature` 的 `extraSelectors` 消除了大量 selector 模板代码。对于新项目，直接使用 `provideStore` + `createFeature` 的组合是当前最佳实践。