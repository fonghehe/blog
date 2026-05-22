---
title: "NgRx 15：Standalone API サポートと Signal Store プレビュー"
date: 2023-01-20 17:22:49
tags:
  - フロントエンド
readingTime: 2
description: "NgRx 15 は Angular 15 と同時にリリースされ、Standalone APIs の完全サポートをもたらしました。NgModule 内で StoreModule や EffectsModule を登録する必要はもうありません。bootstrapApplication 内で関数型 API を使って NgRx スタック全体を設定できるようになりました。"
wordCount: 303
---

NgRx 15 は Angular 15 と同時にリリースされ、Standalone APIs の完全サポートをもたらしました。`NgModule` 内で `StoreModule` や `EffectsModule` を登録する必要はもうありません。`bootstrapApplication` 内で関数型APIを使って NgRx スタック全体を設定できます。

## 新しい関数型設定API

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

古い NgModule 方式との比較：

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

## Feature Store の遅延読み込み

```typescript
// フィーチャールートで feature store を遅延読み込み
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

## createFeature で Feature Store を簡略化

NgRx 15 では `createFeature` がさらに充実し、すべてのセレクターを自動生成します：

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
  // extraSelectors で派生セレクターを拡張
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

## 関数型Effects

NgRx 15 は関数型 effects を導入しました。Angular 14 の関数型 guards と似ています：

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

## まとめ

NgRx 15 の Standalone APIs サポートにより、Angular の状態管理の設定がよりシンプルになり、Angular 15 の方向性と完全に一致しています。`createFeature` の `extraSelectors` により、大量のセレクターテンプレートコードが削減されました。新規プロジェクトでは、`provideStore` + `createFeature` の組み合わせを直接使用することが現在のベストプラクティスです。