---
title: "Angular 21 正式リリース：Signal Forms 安定化、Signal化転換完了"
date: 2025-12-17 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 21 于 2025 年 11 月 19 日正式发布。这是 Angular 自 2022 年启动\"Signal 化转型\"以来最具里程碑意义的版本——Signal Forms 正式稳定，意味着 Angular 组件的所有核心 API（输入、输出、查询、变更检测、表单）已完全 Signal 化。Angular"
wordCount: 322
---

Angular 21 于 2025 年 11 月 19 日正式发布。这是 Angular 自 2022 年启动"Signal 化转型"以来最具里程碑意义的版本——Signal Forms 正式稳定，意味着 Angular 组件的所有核心 API（输入、输出、查询、变更检测、表单）已完全 Signal 化。Angular 的现代化转型，至此划上了句号。

## Angular 21 稳定化的 API 清单

```typescript
// 以下 API 在 Angular 21 中正式稳定（不再有任何实验/预览标记）
import {
  // 组件 API（已于 18.1 稳定）
  input, input.required,
  output, model,
  viewChild, viewChildren,
  contentChild, contentChildren,

  // 响应式原语（已稳定）
  signal, computed, effect,
  linkedSignal,  // 21 正式稳定

  // 异步资源（21 稳定）
  resource,
} from '@angular/core';

import {
  // Signal Forms（21 正式稳定）
  formGroup, formControl, formArray,
  Validators,
  SignalFormsModule,
} from '@angular/forms';

import {
  // HTTP resource（21 稳定）
  httpResource,
} from '@angular/core/rxjs-interop';
```

## 完整的 Angular 21 Signal 组件

一个使用 Angular 21 全部现代 API 的组件：

```typescript
import {
  Component,
  input,
  output,
  viewChild,
  computed,
  effect,
  signal,
  resource,
  ChangeDetectionStrategy,
} from "@angular/core";
import {
  formGroup,
  formControl,
  Validators,
  SignalFormsModule,
} from "@angular/forms";
import { httpResource } from "@angular/core/rxjs-interop";

@Component({
  standalone: true,
  selector: "app-user-settings",
  imports: [SignalFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush, // 新项目默认
  template: `
    <!-- 骨架加载 -->
    @if (userResource.isLoading()) {
      <settings-skeleton />
    }

    <!-- 错误状态 -->
    @else if (userResource.error()) {
      <error-view (retry)="userResource.reload()" />
    }

    <!-- 正常内容 -->
    @else if (userResource.value(); as user) {
      <form [sfGroup]="form" (ngSubmit)="save()">
        <h2>{{ user.displayName }} 的设置</h2>

        <input [sfControl]="form.controls.displayName" />
        <input [sfControl]="form.controls.email" type="email" />

        <button [disabled]="!canSave()">
          {{ isSaving() ? "保存中..." : "保存更改" }}
        </button>
      </form>
    }
  `,
})
export class UserSettingsComponent {
  // Signal Inputs
  userId = input.required<string>();

  // Signal Outputs
  saved = output<User>();

  // httpResource：数据加载
  userResource = httpResource<User>(() => `/api/users/${this.userId()}`);

  // Signal Forms
  form = formGroup({
    displayName: formControl("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    email: formControl("", [Validators.required, Validators.email]),
  });

  // 当数据加载完成时，填充表单
  constructor() {
    effect(() => {
      const user = this.userResource.value();
      if (user) {
        this.form.controls.displayName.setValue(user.displayName);
        this.form.controls.email.setValue(user.email);
        this.form.markAsPristine();
      }
    });
  }

  isSaving = signal(false);

  canSave = computed(
    () => this.form.valid() && this.form.dirty() && !this.isSaving(),
  );

  async save() {
    if (!this.canSave()) return;
    this.isSaving.set(true);
    const updated = await this.userService.update(
      this.userId(),
      this.form.value(),
    );
    this.saved.emit(updated);
    this.isSaving.set(false);
  }
}
```

## 旧 API 的弃用状态

Angular 21 正式发布了以下 API 的弃用警告（不影响运行，但在构建时提示）：

```
@Input()/@Output() 装饰器 → 仍支持，但推荐迁移到 input()/output()
FormControl/FormGroup 类 → 仍支持，但推荐迁移到 Signal Forms
zone.js 在新项目中 → 弃用警告（存量项目不受影响）
```

弃用不等于移除，Angular 团队承诺至少两个主版本内不会删除。

## Angular 21 其他新特性

**路由 Meta 稳定**：

```typescript
// app.routes.ts
{
  path: 'product/:id',
  component: ProductDetailComponent,
  data: { meta: { title: '产品详情', description: '...' } }
}
// 配合 <router-meta /> 指令自动注入 <title> 和 <meta> 标签
```

**构建性能**：Angular 21 使用 Rolldown 作为可选的生产构建后端（实验性），首次支持更快的代码分割策略。

## まとめ

Angular 21 是一个"完成"的版本——3 年的 Signal 化转型在这个版本画上句号。对于 Angular 团队和社区来说，接下来可以更专注于性能（Zoneless 普及、Rolldown 集成）和 DX 改善，而不是 API 重设计。2026 年的 Angular 22 预计会在更稳定的基础上继续推进。
