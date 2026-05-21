---
title: "Angular 20 RC 預覽：Zoneless 穩定、Signal Forms 與全新路由 API"
date: 2025-04-11 10:00:00
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 2
description: "Angular 20 Release Candidate 於 2025 年 4 月初發布，正式版預計 5 月發佈。Angular 20 是 Angular 19（2024 年 11 月）之後的下一個主版本，核心目標是將過去兩年積累的 Signal 化特性全面穩定化，併為\"Zone-free Angular\"打開大門。"
wordCount: 381
---

Angular 20 Release Candidate 於 2025 年 4 月初發布，正式版預計 5 月發佈。Angular 20 是 Angular 19（2024 年 11 月）之後的下一個主版本，核心目標是將過去兩年積累的 Signal 化特性全面穩定化，併為"Zone-free Angular"打開大門。

> 本文基於 Angular 20 RC，正式版 API 可能有細微差異。

## Zoneless 變更檢測：從開發者預覽到正式穩定

Angular 19 的 Zoneless 是開發者預覽，Angular 20 將其提升為穩定 API：

```typescript
// Angular 19（開發者預覽）
import { provideZonelessChangeDetection } from "@angular/core";

// Angular 20（正式穩定）
// API 不變，但標記為 stable，移除實驗性警告
bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // ✅ 正式版，可用於生產
  ],
});
```

同時，`zone.js` 從新項目的默認 polyfills 中移除：

```json
// angular.json（Angular 20 新項目默認）
{
  "build": {
    "options": {
      "polyfills": [] // 不再包含 "zone.js"
    }
  }
}
```

**包體積改善**：移除 zone.js 減少約 33KB（gzip 後約 13KB），對於低端設備和弱網環境有實際意義。

## Signal Forms 開發者預覽

Signal-based Forms 在 Angular 20 中進入開發者預覽：

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";

@Component({
  standalone: true,
  imports: [SignalFormsModule], // 新模塊
  template: `
    <form (ngSubmit)="submit()">
      <input [sfControl]="form.controls.name" placeholder="姓名" />
      @if (form.controls.name.hasError("required")()) {
        <span class="error">姓名必填</span>
      }

      <input
        type="email"
        [sfControl]="form.controls.email"
        placeholder="郵箱"
      />
      @if (form.controls.email.hasError("email")()) {
        <span class="error">郵箱格式不正確</span>
      }

      <button type="submit" [disabled]="!form.valid()">提交</button>
    </form>
  `,
})
export class SignupFormComponent {
  form = formGroup({
    name: formControl("", [Validators.required, Validators.minLength(2)]),
    email: formControl("", [Validators.required, Validators.email]),
    age: formControl<number | null>(null, [Validators.min(18)]),
  });

  isLoading = signal(false);

  // 直接在 computed 中使用表單狀態
  canSubmit = computed(() => this.form.valid() && !this.isLoading());

  submit() {
    if (!this.canSubmit()) return;
    this.isLoading.set(true);

    // form.value() 返回 Signal 當前值
    console.log(this.form.value());
    // { name: 'xxx', email: 'xxx@xxx.com', age: 25 }
  }
}
```

## 全新 Router：Resource API 集成

Angular 20 引入了 `resource()` API（實驗性），允許在組件中聲明式地管理異步資源，並與路由深度集成：

```typescript
import { resource, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({ standalone: true, ... })
export class UserDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(UserApiService);

  // resource()：聲明式異步資源
  userId = toSignal(this.route.paramMap.pipe(map(p => p.get('id')!)));

  userResource = resource({
    request: this.userId,  // 當 userId Signal 變化時自動重新加載
    loader: ({ request: id }) => this.api.getUser(id),
  });

  // 訪問狀態
  user = this.userResource.value;      // Signal<User | undefined>
  isLoading = this.userResource.isLoading;  // Signal<boolean>
  error = this.userResource.error;     // Signal<Error | undefined>
}
```

模板中：

```html
@if (userResource.isLoading()) {
<loading-spinner />
} @else if (userResource.error()) {
<error-message [error]="userResource.error()!" />
} @else if (userResource.value(); as user) {
<user-profile [user]="user" />
}
```

## OnPush 成為新項目默認

Angular 20 CLI 生成的新組件默認使用 `OnPush` 變更檢測（配合 Signals 使用）：

```bash
ng generate component user-card
# 生成的組件默認包含：
# changeDetection: ChangeDetectionStrategy.OnPush
```

```typescript
// Angular 20 CLI 生成的組件模板
@Component({
  selector: "app-user-card",
  standalone: true,
  imports: [],
  templateUrl: "./user-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush, // 新默認值
})
export class UserCardComponent {}
```

## 升級到 Angular 20 RC

```bash
ng update @angular/core@20-rc @angular/cli@20-rc

# 自動遷移：將 zone.js 相關配置更新
# 查看遷移列表
ng update @angular/core@20-rc --dry-run
```

## 總結

Angular 20 是近年來變化最徹底的主版本：Zoneless 正式穩定意味着"沒有 zone.js 的 Angular"真正可以用於生產；Signal Forms 的開發者預覽標誌着表單系統現代化的開始；`resource()` API 填補了異步數據管理的空缺。對於 Angular 團隊而言，這是 2022 年啓動 Signal 化轉型以來最重要的里程碑版本。
