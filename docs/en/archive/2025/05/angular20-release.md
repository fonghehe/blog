---
title: "Angular 20 Official Release: Stable Zoneless, Signal Forms, and resource() API"
date: 2025-05-07 10:00:00
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 2
description: "Angular 20 was officially released in May 2025. This is the most important milestone since Angular's \"Signal transformation\" began in 2022—Zoneless change detec"
wordCount: 217
---

Angular 20 was officially released in May 2025. This is the most important milestone since Angular's "Signal transformation" began in 2022—Zoneless change detection is now officially stable and production-ready; Signal Forms enters developer preview; and the new `resource()` API provides native support for declarative async data management.

## Major Change: zone.js Is No Longer a Default Dependency

When creating a new Angular 20 project, `zone.js` is **no longer included in polyfills by default**:

```bash
# 创建新的 Angular 20 项目
ng new my-app
# 选项：Would you like to use zoneless? (y/N) → 默认 y（推荐）
```

```json
// angular.json（Angular 20 新项目）
{
  "build": {
    "options": {
      "polyfills": [] // 无 zone.js，体积减少 ~13KB gzip
    }
  }
}
```

When migrating an existing project, if you're not ready to remove zone.js yet, you can keep the original configuration as-is (backward compatible).

## Zoneless in Production

In Zoneless mode, all state updates must go through Signals or explicitly call `markForCheck()` to trigger UI updates:

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>消息数量：{{ messageCount() }}</p>
    <button (click)="send()">发送</button>
  `,
})
export class ChatComponent {
  private messages = signal<Message[]>([]);
  messageCount = computed(() => this.messages().length);

  // ✅ 直接修改 Signal → 自动触发 UI 更新（无需 zone.js）
  send() {
    this.messages.update((msgs) => [...msgs, createMessage()]);
  }

  // ✅ 第三方 WebSocket 回调（非 Angular zone）→ 用 signal.set() 更新
  private setupWs() {
    const ws = new WebSocket("/ws");
    ws.onmessage = (evt) => {
      // 直接 .update() 即可，Angular 20 Zoneless 会检测到变化
      this.messages.update((msgs) => [...msgs, JSON.parse(evt.data)]);
    };
  }
}
```

## Signal Forms Developer Preview

```typescript
import {
  formGroup,
  formControl,
  Validators,
  SignalFormsModule,
} from "@angular/forms";

@Component({
  standalone: true,
  imports: [SignalFormsModule],
  template: `
    <form (ngSubmit)="onSubmit()">
      <div class="field">
        <input [sfControl]="form.controls.username" />
        @if (form.controls.username.hasError("required")()) {
          <small>用户名必填</small>
        }
        @if (form.controls.username.hasError("minlength")(); as err) {
          <small>至少 {{ err.requiredLength }} 个字符</small>
        }
      </div>

      <button [disabled]="form.invalid() || isSubmitting()">
        {{ isSubmitting() ? "提交中..." : "提交" }}
      </button>
    </form>
  `,
})
export class LoginComponent {
  form = formGroup({
    username: formControl("", [Validators.required, Validators.minLength(3)]),
    password: formControl("", [Validators.required]),
  });

  isSubmitting = signal(false);

  async onSubmit() {
    if (this.form.invalid()) return;
    this.isSubmitting.set(true);
    try {
      await this.authService.login(this.form.value());
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
```

Note: Signal Forms is a **developer preview**; the API may change in future versions. The existing `ReactiveFormsModule` and `FormsModule` continue to be fully supported.

## resource() API: Declarative Async Resources

```typescript
import { resource, signal, computed } from '@angular/core';

@Component({ standalone: true, ... })
export class ProductListComponent {
  category = signal<string>('all');
  page = signal(1);

  // resource 自动管理加载/错误/成功状态
  products = resource({
    request: computed(() => ({ category: this.category(), page: this.page() })),
    loader: async ({ request }) => {
      const res = await fetch(`/api/products?cat=${request.category}&page=${request.page}`);
      return res.json() as Promise<Product[]>;
    }
  });

  // 手动刷新
  refresh() {
    this.products.reload();
  }
}
```

Accessing state directly in the template:

```html
@if (products.isLoading()) {
<skeleton-list />
} @else if (products.error()) {
<error-view (retry)="refresh()" />
} @else { @for (product of products.value()!; track product.id) {
<product-card [product]="product" />
} }
```

## Key Differences from Angular 19

```
Angular 19              Angular 20
────────────────────────────────────────────────
Zoneless: Developer Preview  → Officially Stable
Signal Forms: None           → Developer Preview
resource(): None             → Experimental (RC)
OnPush default: No           → Yes for new projects
zone.js: Included by default → Excluded for new projects
```

## Conclusion

Angular 20 is the "delivery year" for Angular's 2022–2025 transformation roadmap. For teams already using Angular 17–19, now is the time to seriously evaluate the Zoneless migration path and try out the Signal Forms developer preview. Angular's reactive model is converging toward the norms of the modern JS ecosystem—with Signals as the unified fundamental unit of state.
