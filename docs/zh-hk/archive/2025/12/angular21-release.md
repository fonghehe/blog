---
title: "Angular 21 正式發佈：Signal Forms 穩定，Signal 化轉型完成"
date: 2025-12-17 15:31:08
tags:
  - Angular
readingTime: 2
description: "Angular 21 於 2025 年 11 月 19 日正式發佈。這是 Angular 自 2022 年啓動\"Signal 化轉型\"以來最具里程碑意義的版本——Signal Forms 正式穩定，意味着 Angular 組件的所有核心 API（輸入、輸出、查詢、變更檢測、表單）已完全 Signal 化。Angular"
wordCount: 321
---

Angular 21 於 2025 年 11 月 19 日正式發佈。這是 Angular 自 2022 年啓動"Signal 化轉型"以來最具里程碑意義的版本——Signal Forms 正式穩定，意味着 Angular 組件的所有核心 API（輸入、輸出、查詢、變更檢測、表單）已完全 Signal 化。Angular 的現代化轉型，至此劃上了句號。

## Angular 21 穩定化的 API 清單

```typescript
// 以下 API 在 Angular 21 中正式穩定（不再有任何實驗/預覽標記）
import {
  // 組件 API（已於 18.1 穩定）
  input, input.required,
  output, model,
  viewChild, viewChildren,
  contentChild, contentChildren,

  // 響應式原語（已穩定）
  signal, computed, effect,
  linkedSignal,  // 21 正式穩定

  // 異步資源（21 穩定）
  resource,
} from '@angular/core';

import {
  // Signal Forms（21 正式穩定）
  formGroup, formControl, formArray,
  Validators,
  SignalFormsModule,
} from '@angular/forms';

import {
  // HTTP resource（21 穩定）
  httpResource,
} from '@angular/core/rxjs-interop';
```

## 完整的 Angular 21 Signal 組件

一個使用 Angular 21 全部現代 API 的組件：

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
  changeDetection: ChangeDetectionStrategy.OnPush, // 新項目默認
  template: `
    <!-- 骨架加載 -->
    @if (userResource.isLoading()) {
      <settings-skeleton />
    }

    <!-- 錯誤狀態 -->
    @else if (userResource.error()) {
      <error-view (retry)="userResource.reload()" />
    }

    <!-- 正常內容 -->
    @else if (userResource.value(); as user) {
      <form [sfGroup]="form" (ngSubmit)="save()">
        <h2>{{ user.displayName }} 的設置</h2>

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

  // httpResource：數據加載
  userResource = httpResource<User>(() => `/api/users/${this.userId()}`);

  // Signal Forms
  form = formGroup({
    displayName: formControl("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    email: formControl("", [Validators.required, Validators.email]),
  });

  // 當數據加載完成時，填充表單
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

## 舊 API 的棄用狀態

Angular 21 正式發佈了以下 API 的棄用警告（不影響運行，但在構建時提示）：

```
@Input()/@Output() 裝飾器 → 仍支持，但推薦遷移到 input()/output()
FormControl/FormGroup 類 → 仍支持，但推薦遷移到 Signal Forms
zone.js 在新項目中 → 棄用警告（存量項目不受影響）
```

棄用不等於移除，Angular 團隊承諾至少兩個主版本內不會刪除。

## Angular 21 其他新特性

**路由 Meta 穩定**：

```typescript
// app.routes.ts
{
  path: 'product/:id',
  component: ProductDetailComponent,
  data: { meta: { title: '產品詳情', description: '...' } }
}
// 配合 <router-meta /> 指令自動注入 <title> 和 <meta> 標籤
```

**構建效能**：Angular 21 使用 Rolldown 作為可選的生產構建後端（實驗性），首次支援更快的代碼分割策略。

## 總結

Angular 21 是一個"完成"的版本——3 年的 Signal 化轉型在這個版本畫上句號。對於 Angular 團隊和社區來説，接下來可以更專注於性能（Zoneless 普及、Rolldown 集成）和 DX 改善，而不是 API 重設計。2026 年的 Angular 22 預計會在更穩定的基礎上繼續推進。
