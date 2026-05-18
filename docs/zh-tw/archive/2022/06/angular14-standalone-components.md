---
title: "Angular 14 釋出：Standalone Components 重塑模組化開發"
date: 2022-06-15 16:44:03
tags:
  - Angular
readingTime: 2
description: "Angular 14 於 2022 年 6 月 2 日正式釋出，這是 Angular 近年來最重要的版本之一。Standalone Components（獨立元件）從根本上改變了 Angular 的模組化方式——元件不再強制依附於 `NgModule`，可以直接宣告自己的依賴。"
---

Angular 14 於 2022 年 6 月 2 日正式釋出，這是 Angular 近年來最重要的版本之一。Standalone Components（獨立元件）從根本上改變了 Angular 的模組化方式——元件不再強制依附於 `NgModule`，可以直接宣告自己的依賴。

## 什麼是 Standalone Component

```typescript
// 舊方式：元件必須屬於某個 NgModule
@NgModule({
  declarations: [ButtonComponent],
  imports: [CommonModule],
  exports: [ButtonComponent],
})
export class ButtonModule {}

// Angular 14 新方式：standalone 元件自己管理依賴
@Component({
  selector: "app-button",
  standalone: true, // 標記為獨立元件
  imports: [NgClass, NgIf], // 直接匯入需要的指令/管道
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

## 應用引導：bootstrapApplication

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
    // 其他全域性 providers
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
    // 懶載入 standalone 路由組（無需 Module）
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

## inject() 函式：函式式依賴注入

Angular 14 引入了 `inject()` 函式，可以在 injection context 中呼叫（元件構造期間、工廠函式等）：

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

// inject() 在路由守衛中特別有用（函式式守衛）
export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() || router.createUrlTree(['/login']);
};

// 在路由中使用函式式守衛
{
  path: 'admin',
  canActivate: [authGuard],
  loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
}
```

## 嚴格型別化表單（TypedForms）

Angular 14 的另一個重大改進：響應式表單終於有了完整的 TypeScript 型別：

```typescript
// Angular 14 之前：FormControl 是 any 型別
const name = new FormControl("");
name.value; // 型別是 string | null（正確！Angular 14）
name.setValue(42); // Angular 14: 報錯 ✓（之前不報錯）

// 複雜表單型別推斷
const loginForm = new FormGroup({
  email: new FormControl("", Validators.required),
  password: new FormControl("", Validators.required),
  rememberMe: new FormControl(false),
});

// loginForm.value 型別推斷為：
// { email: string | null; password: string | null; rememberMe: boolean | null }
```

## 從 NgModule 遷移到 Standalone

Angular 14 提供了遷移 schematic：

```bash
ng generate @angular/core:standalone

# 遷移步驟：
# 1. 將元件/指令/管道標記為 standalone
# 2. 移除不再需要的 NgModule
# 3. 更新 bootstrap
```

## 總結

Angular 14 的 Standalone Components 是向"無 NgModule"架構邁出的第一步。它降低了 Angular 的學習曲線（NgModule 是新手最困惑的概念之一），並讓程式碼更易於按功能組織。TypedForms 則補上了長期缺失的型別安全缺口。Angular 正在變得更現代，更簡潔。