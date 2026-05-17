---
title: "Angular 14 リリース：スタンドアロンコンポーネントがモジュール開発を再定義"
date: 2022-06-15 16:44:03
tags:
  - Angular
readingTime: 2
description: "Angular 14 于 2022 年 6 月 2 日正式发布，这是 Angular 近年来最重要的版本之一。Standalone Components（独立组件）从根本上改变了 Angular 的模块化方式——组件不再强制依附于 `NgModule`，可以直接声明自己的依赖。"
---

Angular 14 于 2022 年 6 月 2 日正式发布，这是 Angular 近年来最重要的版本之一。Standalone Components（独立组件）从根本上改变了 Angular 的模块化方式——组件不再强制依附于 `NgModule`，可以直接声明自己的依赖。

## 什么是 Standalone Component

```typescript
// 旧方式：组件必须属于某个 NgModule
@NgModule({
  declarations: [ButtonComponent],
  imports: [CommonModule],
  exports: [ButtonComponent],
})
export class ButtonModule {}

// Angular 14 新方式：standalone 组件自己管理依赖
@Component({
  selector: "app-button",
  standalone: true, // 标记为独立组件
  imports: [NgClass, NgIf], // 直接导入需要的指令/管道
  template: `
    <button [ngClass]="variant" *ngIf="visible">{{ label }}</button>
  `,
})
export class ButtonComponent {
  @Input() label = "Click";
  @Input() variant = "primary";
  @Input() visible = true;
}
```

## 应用引导：bootstrapApplication

```typescript
// main.ts（Angular 14 新方式，不需要 AppModule）
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { routes } from "./app/app.routes";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // 其他全局 providers
  ],
}).catch((err) => console.error(err));
```

## Standalone 路由配置

```typescript
// app.routes.ts
import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./home/home.component").then((m) => m.HomeComponent),
  },
  {
    path: "products",
    // 懒加载 standalone 路由组（无需 Module）
    loadChildren: () =>
      import("./products/product.routes").then((m) => m.PRODUCT_ROUTES),
  },
];

// products/product.routes.ts
export const PRODUCT_ROUTES: Routes = [
  { path: "", component: ProductListComponent },
  { path: ":id", component: ProductDetailComponent },
];
```

## inject() 函数：函数式依赖注入

Angular 14 引入了 `inject()` 函数，可以在 injection context 中调用（组件构造期间、工厂函数等）：

```typescript
// 不再需要 constructor 注入
@Component({
  selector: 'app-user-profile',
  standalone: true,
  template: `<p>{{ user()?.name }}</p>`
})
export class UserProfileComponent {
  private userService = inject(UserService);   // inject() 替代 constructor 注入
  private route = inject(ActivatedRoute);

  user = toSignal(this.route.paramMap.pipe(
    switchMap(params => this.userService.getUser(params.get('id')!))
  ));
}

// inject() 在路由守卫中特别有用（函数式守卫）
export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() || router.createUrlTree(['/login']);
};

// 在路由中使用函数式守卫
{
  path: 'admin',
  canActivate: [authGuard],
  loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
}
```

## 严格类型化表单（TypedForms）

Angular 14 的另一个重大改进：响应式表单终于有了完整的 TypeScript 类型：

```typescript
// Angular 14 之前：FormControl 是 any 类型
const name = new FormControl("");
name.value; // 类型是 string | null（正确！Angular 14）
name.setValue(42); // Angular 14: 报错 ✓（之前不报错）

// 复杂表单类型推断
const loginForm = new FormGroup({
  email: new FormControl("", Validators.required),
  password: new FormControl("", Validators.required),
  rememberMe: new FormControl(false),
});

// loginForm.value 类型推断为：
// { email: string | null; password: string | null; rememberMe: boolean | null }
```

## 从 NgModule 迁移到 Standalone

Angular 14 提供了迁移 schematic：

```bash
ng generate @angular/core:standalone

# 迁移步骤：
# 1. 将组件/指令/管道标记为 standalone
# 2. 移除不再需要的 NgModule
# 3. 更新 bootstrap
```

## まとめ

Angular 14 的 Standalone Components 是向"无 NgModule"架构迈出的第一步。它降低了 Angular 的学习曲线（NgModule 是新手最困惑的概念之一），并让代码更易于按功能组织。TypedForms 则补上了长期缺失的类型安全缺口。Angular 正在变得更现代，更简洁。