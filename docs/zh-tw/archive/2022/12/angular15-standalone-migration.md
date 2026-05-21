---
title: "Angular 15 獨立 API 遷移：從 NgModule 到 Standalone 完整指南"
date: 2022-12-02 14:50:34
tags:
  - Angular
readingTime: 2
description: "Angular 15 讓 Standalone APIs 正式穩定後，很多團隊開始考慮遷移現有專案。Angular 提供了自動化遷移工具，但瞭解遷移的每個步驟和潛在問題仍然必要。這篇文章梳理完整的遷移路徑。"
wordCount: 239
---

Angular 15 讓 Standalone APIs 正式穩定後，很多團隊開始考慮遷移現有專案。Angular 提供了自動化遷移工具，但瞭解遷移的每個步驟和潛在問題仍然必要。這篇文章梳理完整的遷移路徑。

## 自動遷移工具

```bash
# Angular 15 提供三個遷移 schematic，建議按順序執行

# 第一步：將元件/指令/管道標記為 standalone
ng generate @angular/core:standalone
# 選擇 "Convert all components, directives and pipes to standalone"
# 這會給每個元件加上 standalone: true，並將 NgModule 的 imports 移到元件的 imports

# 第二步：移除不必要的 NgModule
ng generate @angular/core:standalone
# 選擇 "Remove unnecessary NgModule classes"
# 只保留 entryComponent 和 Feature 路由模組（如果還在用）

# 第三步：遷移 bootstrap
ng generate @angular/core:standalone
# 選擇 "Bootstrap the project using standalone APIs"
# 將 platformBrowserDynamic().bootstrapModule(AppModule) 改為 bootstrapApplication
```

## 手動遷移的要點

### 1. 元件依賴從 Module 移到 Component

```typescript
// 遷移前：元件通過 NgModule 獲得依賴
@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule, MatCardModule, RouterModule],
  exports: [UserCardComponent],
})
export class UserCardModule {}

// 遷移後：元件直接宣告依賴
@Component({
  selector: "app-user-card",
  standalone: true,
  imports: [
    NgIf,
    NgFor, // 從 CommonModule 單獨引入
    MatCardModule,
    RouterLink, // 從 RouterModule 單獨引入
  ],
  template: `...`,
})
export class UserCardComponent {}
```

### 2. 路由模組遷移

```typescript
// 遷移前：Feature 路由模組
@NgModule({
  imports: [
    RouterModule.forChild([
      { path: '', component: UserListComponent },
      { path: ':id', component: UserDetailComponent }
    ])
  ]
})
export class UserRoutingModule {}

// 遷移後：路由陣列（無 NgModule）
// users/user.routes.ts
export const USER_ROUTES: Routes = [
  { path: '', component: UserListComponent },
  { path: ':id', component: UserDetailComponent }
];

// 主路由中引用
{
  path: 'users',
  loadChildren: () => import('./users/user.routes').then(m => m.USER_ROUTES)
}
```

### 3. 全域性 providers 遷移

```typescript
// 遷移前：AppModule
@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot(routes),
    StoreModule.forRoot(reducers), // NgRx
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

// 遷移後：main.ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([authInterceptor]), // 函式式攔截器
    ),
    provideStore(reducers), // NgRx standalone API
    provideEffects([UserEffects]),
    provideStoreDevtools(),
  ],
});
```

### 4. SharedModule 拆分

遷移中最麻煩的通常是 `SharedModule`（包含大量公共元件）：

```typescript
// 遷移前：大型 SharedModule
@NgModule({
  imports: [CommonModule, RouterModule, ...],
  declarations: [ButtonComponent, CardComponent, TableComponent, ...],
  exports: [ButtonComponent, CardComponent, TableComponent, CommonModule, RouterModule, ...]
})
export class SharedModule {}

// 遷移後：每個元件自包含，可以單獨按需匯入
// 不再需要 SharedModule，直接在需要的地方匯入具體元件：
@Component({
  standalone: true,
  imports: [ButtonComponent, CardComponent],  // 按需匯入
  ...
})
export class SomePageComponent {}
```

## 遷移常見問題

```typescript
// 問題 1：APP_INITIALIZER 怎麼遷移
// 遷移前（NgModule）
providers: [{
  provide: APP_INITIALIZER,
  useFactory: (config: ConfigService) => () => config.load(),
  deps: [ConfigService],
  multi: true
}]

// 遷移後（bootstrapApplication）
providers: [{
  provide: APP_INITIALIZER,
  useFactory: () => {
    const config = inject(ConfigService);  // 使用 inject()
    return () => config.load();
  },
  multi: true
}]

// 問題 2：懶載入的 standalone 元件 vs 懶載入路由組
// 單個 standalone 元件懶載入
{ path: 'about', loadComponent: () => import('./about.component').then(m => m.AboutComponent) }

// 多個元件組成的功能懶載入（推薦）
{ path: 'products', loadChildren: () => import('./product.routes').then(m => m.PRODUCT_ROUTES) }
```

## 遷移進度策略

不必一次性全遷移，推薦漸進式：

```
階段 1：新功能全部用 Standalone 開發
階段 2：逐步遷移葉子元件（無子元件依賴的元件）
階段 3：遷移 SharedModule 中的元件
階段 4：遷移 Feature Module
階段 5：遷移 AppModule，改用 bootstrapApplication
```

## 總結

Angular 15 的 Standalone 遷移工具降低了遷移成本，但對於大型專案仍需要謹慎規劃。最重要的是理解：Standalone 不是"新功能"，而是 NgModule 的替代——兩者可以共存，遷移可以漸進進行。遷完之後程式碼量通常減少 20-30%，架構也更直觀。