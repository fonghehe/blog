---
title: "Angular 20 RC 预览：Zoneless 稳定、Signal Forms 与全新路由 API"
date: 2025-04-11 10:00:00
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 2
description: "Angular 20 Release Candidate 于 2025 年 4 月初发布，正式版预计 5 月发布。Angular 20 是 Angular 19（2024 年 11 月）之后的下一个主版本，核心目标是将过去两年积累的 Signal 化特性全面稳定化，并为\"Zone-free Angular\"打开大门。"
---

Angular 20 Release Candidate 于 2025 年 4 月初发布，正式版预计 5 月发布。Angular 20 是 Angular 19（2024 年 11 月）之后的下一个主版本，核心目标是将过去两年积累的 Signal 化特性全面稳定化，并为"Zone-free Angular"打开大门。

> 本文基于 Angular 20 RC，正式版 API 可能有细微差异。

## Zoneless 变更检测：从开发者预览到正式稳定

Angular 19 的 Zoneless 是开发者预览，Angular 20 将其提升为稳定 API：

```typescript
// Angular 19（开发者预览）
import { provideZonelessChangeDetection } from "@angular/core";

// Angular 20（正式稳定）
// API 不变，但标记为 stable，移除实验性警告
bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // ✅ 正式版，可用于生产
  ],
});
```

同时，`zone.js` 从新项目的默认 polyfills 中移除：

```json
// angular.json（Angular 20 新项目默认）
{
  "build": {
    "options": {
      "polyfills": [] // 不再包含 "zone.js"
    }
  }
}
```

**包体积改善**：移除 zone.js 减少约 33KB（gzip 后约 13KB），对于低端设备和弱网环境有实际意义。

## Signal Forms 开发者预览

Signal-based Forms 在 Angular 20 中进入开发者预览：

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";

@Component({
  standalone: true,
  imports: [SignalFormsModule], // 新模块
  template: `
    <form (ngSubmit)="submit()">
      <input [sfControl]="form.controls.name" placeholder="姓名" />
      @if (form.controls.name.hasError("required")()) {
        <span class="error">姓名必填</span>
      }

      <input
        type="email"
        [sfControl]="form.controls.email"
        placeholder="邮箱"
      />
      @if (form.controls.email.hasError("email")()) {
        <span class="error">邮箱格式不正确</span>
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

  // 直接在 computed 中使用表单状态
  canSubmit = computed(() => this.form.valid() && !this.isLoading());

  submit() {
    if (!this.canSubmit()) return;
    this.isLoading.set(true);

    // form.value() 返回 Signal 当前值
    console.log(this.form.value());
    // { name: 'xxx', email: 'xxx@xxx.com', age: 25 }
  }
}
```

## 全新 Router：Resource API 集成

Angular 20 引入了 `resource()` API（实验性），允许在组件中声明式地管理异步资源，并与路由深度集成：

```typescript
import { resource, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({ standalone: true, ... })
export class UserDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(UserApiService);

  // resource()：声明式异步资源
  userId = toSignal(this.route.paramMap.pipe(map(p => p.get('id')!)));

  userResource = resource({
    request: this.userId,  // 当 userId Signal 变化时自动重新加载
    loader: ({ request: id }) => this.api.getUser(id),
  });

  // 访问状态
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

## OnPush 成为新项目默认

Angular 20 CLI 生成的新组件默认使用 `OnPush` 变更检测（配合 Signals 使用）：

```bash
ng generate component user-card
# 生成的组件默认包含：
# changeDetection: ChangeDetectionStrategy.OnPush
```

```typescript
// Angular 20 CLI 生成的组件模板
@Component({
  selector: "app-user-card",
  standalone: true,
  imports: [],
  templateUrl: "./user-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush, // 新默认值
})
export class UserCardComponent {}
```

## 升级到 Angular 20 RC

```bash
ng update @angular/core@20-rc @angular/cli@20-rc

# 自动迁移：将 zone.js 相关配置更新
# 查看迁移列表
ng update @angular/core@20-rc --dry-run
```

## 总结

Angular 20 是近年来变化最彻底的主版本：Zoneless 正式稳定意味着"没有 zone.js 的 Angular"真正可以用于生产；Signal Forms 的开发者预览标志着表单系统现代化的开始；`resource()` API 填补了异步数据管理的空缺。对于 Angular 团队而言，这是 2022 年启动 Signal 化转型以来最重要的里程碑版本。
