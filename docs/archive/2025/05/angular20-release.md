---
title: "Angular 20 正式发布：Zoneless 稳定、Signal Forms 与 resource() API"
date: 2025-05-07 10:00:00
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 2
description: "Angular 20 于 2025 年 5 月正式发布。这是 Angular 自 2022 年开始\"Signal 化转型\"以来最重要的里程碑——Zoneless 变更检测正式稳定，可用于生产；Signal Forms 进入开发者预览；新的 `resource()` API 为声明式异步数据管理提供了原生支持。"
---

Angular 20 于 2025 年 5 月正式发布。这是 Angular 自 2022 年开始"Signal 化转型"以来最重要的里程碑——Zoneless 变更检测正式稳定，可用于生产；Signal Forms 进入开发者预览；新的 `resource()` API 为声明式异步数据管理提供了原生支持。

## 重大变化：zone.js 不再是默认依赖

新建 Angular 20 项目时，`zone.js` **不再默认包含在 polyfills 中**：

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

迁移老项目时，如果暂时不想移除 zone.js，可以保持原配置不变（向后兼容）。

## Zoneless 在生产环境的实践

Zoneless 模式下，所有状态更新必须通过 Signal 或显式标记 `markForCheck()` 触发 UI 更新：

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

## Signal Forms 开发者预览

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

注意：Signal Forms 是**开发者预览**，API 在未来版本可能调整。旧的 `ReactiveFormsModule` 和 `FormsModule` 继续完全支持。

## resource() API：声明式异步资源

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

模板中直接访问状态：

```html
@if (products.isLoading()) {
<skeleton-list />
} @else if (products.error()) {
<error-view (retry)="refresh()" />
} @else { @for (product of products.value()!; track product.id) {
<product-card [product]="product" />
} }
```

## 与 Angular 19 的主要差异

```
Angular 19              Angular 20
────────────────────────────────────────────────
Zoneless: 开发者预览    → 正式稳定
Signal Forms: 无        → 开发者预览
resource(): 无          → 实验性（RC）
OnPush 默认: 否         → 新项目默认是
zone.js: 默认包含       → 新项目默认不包含
```

## 总结

Angular 20 是 Angular 2022-2025 转型路线图的"交付年"。对于已经在用 Angular 17-19 的团队，今年可以开始认真评估 Zoneless 迁移路径，并试用 Signal Forms 开发者预览。Angular 的响应式模型正变得更接近现代 JS 生态的习惯——Signal 作为统一的状态基本单元。
