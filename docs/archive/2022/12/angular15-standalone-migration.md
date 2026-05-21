---
title: "Angular 15 独立 API 迁移：从 NgModule 到 Standalone 完整指南"
date: 2022-12-02 14:50:34
tags:
  - Angular
readingTime: 2
description: "Angular 15 让 Standalone APIs 正式稳定后，很多团队开始考虑迁移现有项目。Angular 提供了自动化迁移工具，但了解迁移的每个步骤和潜在问题仍然必要。这篇文章梳理完整的迁移路径。"
wordCount: 237
---

Angular 15 让 Standalone APIs 正式稳定后，很多团队开始考虑迁移现有项目。Angular 提供了自动化迁移工具，但了解迁移的每个步骤和潜在问题仍然必要。这篇文章梳理完整的迁移路径。

## 自动迁移工具

```bash
# Angular 15 提供三个迁移 schematic，建议按顺序执行

# 第一步：将组件/指令/管道标记为 standalone
ng generate @angular/core:standalone
# 选择 "Convert all components, directives and pipes to standalone"
# 这会给每个组件加上 standalone: true，并将 NgModule 的 imports 移到组件的 imports

# 第二步：移除不必要的 NgModule
ng generate @angular/core:standalone
# 选择 "Remove unnecessary NgModule classes"
# 只保留 entryComponent 和 Feature 路由模块（如果还在用）

# 第三步：迁移 bootstrap
ng generate @angular/core:standalone
# 选择 "Bootstrap the project using standalone APIs"
# 将 platformBrowserDynamic().bootstrapModule(AppModule) 改为 bootstrapApplication
```

## 手动迁移的要点

### 1. 组件依赖从 Module 移到 Component

```typescript
// 迁移前：组件通过 NgModule 获得依赖
@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule, MatCardModule, RouterModule],
  exports: [UserCardComponent],
})
export class UserCardModule {}

// 迁移后：组件直接声明依赖
@Component({
  selector: "app-user-card",
  standalone: true,
  imports: [
    NgIf,
    NgFor, // 从 CommonModule 单独引入
    MatCardModule,
    RouterLink, // 从 RouterModule 单独引入
  ],
  template: `...`,
})
export class UserCardComponent {}
```

### 2. 路由模块迁移

```typescript
// 迁移前：Feature 路由模块
@NgModule({
  imports: [
    RouterModule.forChild([
      { path: '', component: UserListComponent },
      { path: ':id', component: UserDetailComponent }
    ])
  ]
})
export class UserRoutingModule {}

// 迁移后：路由数组（无 NgModule）
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

### 3. 全局 providers 迁移

```typescript
// 迁移前：AppModule
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

// 迁移后：main.ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([authInterceptor]), // 函数式拦截器
    ),
    provideStore(reducers), // NgRx standalone API
    provideEffects([UserEffects]),
    provideStoreDevtools(),
  ],
});
```

### 4. SharedModule 拆分

迁移中最麻烦的通常是 `SharedModule`（包含大量公共组件）：

```typescript
// 迁移前：大型 SharedModule
@NgModule({
  imports: [CommonModule, RouterModule, ...],
  declarations: [ButtonComponent, CardComponent, TableComponent, ...],
  exports: [ButtonComponent, CardComponent, TableComponent, CommonModule, RouterModule, ...]
})
export class SharedModule {}

// 迁移后：每个组件自包含，可以单独按需导入
// 不再需要 SharedModule，直接在需要的地方导入具体组件：
@Component({
  standalone: true,
  imports: [ButtonComponent, CardComponent],  // 按需导入
  ...
})
export class SomePageComponent {}
```

## 迁移常见问题

```typescript
// 问题 1：APP_INITIALIZER 怎么迁移
// 迁移前（NgModule）
providers: [{
  provide: APP_INITIALIZER,
  useFactory: (config: ConfigService) => () => config.load(),
  deps: [ConfigService],
  multi: true
}]

// 迁移后（bootstrapApplication）
providers: [{
  provide: APP_INITIALIZER,
  useFactory: () => {
    const config = inject(ConfigService);  // 使用 inject()
    return () => config.load();
  },
  multi: true
}]

// 问题 2：懒加载的 standalone 组件 vs 懒加载路由组
// 单个 standalone 组件懒加载
{ path: 'about', loadComponent: () => import('./about.component').then(m => m.AboutComponent) }

// 多个组件组成的功能懒加载（推荐）
{ path: 'products', loadChildren: () => import('./product.routes').then(m => m.PRODUCT_ROUTES) }
```

## 迁移进度策略

不必一次性全迁移，推荐渐进式：

```
阶段 1：新功能全部用 Standalone 开发
阶段 2：逐步迁移叶子组件（无子组件依赖的组件）
阶段 3：迁移 SharedModule 中的组件
阶段 4：迁移 Feature Module
阶段 5：迁移 AppModule，改用 bootstrapApplication
```

## 总结

Angular 15 的 Standalone 迁移工具降低了迁移成本，但对于大型项目仍需要谨慎规划。最重要的是理解：Standalone 不是"新功能"，而是 NgModule 的替代——两者可以共存，迁移可以渐进进行。迁完之后代码量通常减少 20-30%，架构也更直观。