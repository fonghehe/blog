---
title: "Angular 14 リリース：スタンドアロンコンポーネントがモジュール開発を再定義"
date: 2022-06-15 16:44:03
tags:
  - Angular
readingTime: 3
description: "Angular 14 は2022年6月2日に正式リリースされました。これは Angular にとって近年最も重要なバージョンの1つです。Standalone Components（独立コンポーネント）は Angular のモジュール方式を根本的に変えました——コンポーネントは NgModule に強制的に依存する必要がなくなり、自身の依存関係を直接宣言できるようになりました。"
wordCount: 436
---

Angular 14 は 2022 年 6 月 2 日に正式リリースされました。これは Angular にとって近年最も重要なバージョンの 1 つです。Standalone Components（スタンドアロンコンポーネント）は Angular のモジュール方式を根本的に変えました——コンポーネントは強制的に `NgModule` に依存する必要がなくなり、自身の依存関係を直接宣言できるようになりました。

## Standalone Component とは

```typescript
// 旧方式：コンポーネントは必ず NgModule に属する必要がある
@NgModule({
  declarations: [ButtonComponent],
  imports: [CommonModule],
  exports: [ButtonComponent],
})
export class ButtonModule {}

// Angular 14 新方式：standalone コンポーネントが自身で依存関係を管理
@Component({
  selector: "app-button",
  standalone: true, // スタンドアロンコンポーネントとしてマーク
  imports: [NgClass, NgIf], // 必要なディレクティブ/パイプを直接インポート
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

## アプリケーションブートストラップ：bootstrapApplication

```typescript
// main.ts（Angular 14 新方式、AppModule 不要）
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { routes } from "./app/app.routes";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // その他のグローバル providers
  ],
}).catch((err) => console.error(err));
```

## Standalone ルーティング設定

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
    // スタンドアロンルートグループを遅延ロード（Module 不要）
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

## inject() 関数：関数型依存性注入

Angular 14 では `inject()` 関数が導入され、injection context（コンポーネント構築時、ファクトリ関数など）で呼び出せるようになりました：

```typescript
// もはや constructor 注入は不要
@Component({
  selector: 'app-user-profile',
  standalone: true,
  template: `<p>{{ user()?.name }}</p>`
})
export class UserProfileComponent {
  private userService = inject(UserService);   // inject() でコンストラクタ注入を代替
  private route = inject(ActivatedRoute);

  user = toSignal(this.route.paramMap.pipe(
    switchMap(params => this.userService.getUser(params.get('id')!))
  ));
}

// inject() はルートガードで特に有用（関数型ガード）
export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() || router.createUrlTree(['/login']);
};

// ルートで関数型ガードを使用
{
  path: 'admin',
  canActivate: [authGuard],
  loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
}
```

## 厳格な型付きフォーム（TypedForms）

Angular 14 のもう一つの重要な改善点：リアクティブフォームに完全な TypeScript 型がついに導入されました：

```typescript
// Angular 14 以前：FormControl は any 型
const name = new FormControl("");
name.value; // 型は string | null（正しい！Angular 14）
name.setValue(42); // Angular 14: エラー ✓（以前はエラーにならなかった）

// 複雑なフォームの型推論
const loginForm = new FormGroup({
  email: new FormControl("", Validators.required),
  password: new FormControl("", Validators.required),
  rememberMe: new FormControl(false),
});

// loginForm.value の型推論結果：
// { email: string | null; password: string | null; rememberMe: boolean | null }
```

## NgModule から Standalone への移行

Angular 14 は移行用の schematic を提供しています：

```bash
ng generate @angular/core:standalone

# 移行手順：
# 1. コンポーネント/ディレクティブ/パイプを standalone としてマーク
# 2. 不要になった NgModule を削除
# 3. bootstrap を更新
```

## まとめ

Angular 14 の Standalone Components は、「NgModule 不要」アーキテクチャへの第一歩です。これにより Angular の学習曲線が緩やかになり（NgModule は初心者が最も困惑する概念の一つでした）、コードを機能ごとに整理しやすくなりました。TypedForms は長らく欠けていた型安全性のギャップを埋めています。Angular はより現代的で、よりシンプルになりつつあります。
