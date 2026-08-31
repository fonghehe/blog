---
title: "Angular 14 Release: Standalone Components Reshape Modular Development"
date: 2022-06-15 16:44:03
tags:
  - Angular
readingTime: 2
description: "Angular 14 was officially released on June 2, 2022, marking one of the most significant Angular releases in recent years. Standalone Components fundamentally change how Angular handles modularity — components no longer need to belong to an `NgModule` and can declare their own dependencies directly."
wordCount: 161
---

Angular 14 was officially released on June 2, 2022, marking one of the most significant Angular releases in recent years. Standalone Components fundamentally change how Angular handles modularity — components no longer need to belong to an `NgModule` and can declare their own dependencies directly.

## What Is a Standalone Component

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

## Application Bootstrapping: bootstrapApplication

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

## Standalone Route Configuration

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

## The inject() Function: Functional Dependency Injection

Angular 14 introduced the `inject()` function, which can be called in an injection context (during component construction, factory functions, etc.):

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

## Strictly Typed Forms (TypedForms)

Another major improvement in Angular 14: reactive forms finally have full TypeScript types:

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

## Migrating from NgModule to Standalone

Angular 14 provides a migration schematic:

```bash
ng generate @angular/core:standalone

# 迁移步骤：
# 1. 将组件/指令/管道标记为 standalone
# 2. 移除不再需要的 NgModule
# 3. 更新 bootstrap
```

## Summary

Angular 14's Standalone Components are the first step toward an "NgModule-free" architecture. They lower Angular's learning curve (NgModule is one of the most confusing concepts for beginners) and make it easier to organize code by feature. TypedForms fills a long-standing type safety gap. Angular is becoming more modern and cleaner.