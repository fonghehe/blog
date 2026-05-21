---
title: "Angular 20 正式發佈：Zoneless 穩定、Signal Forms 與 resource() API"
date: 2025-05-07 10:00:00
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 2
description: "Angular 20 於 2025 年 5 月正式發佈。這是 Angular 自 2022 年開始\"Signal 化轉型\"以來最重要的里程碑——Zoneless 變更檢測正式穩定，可用於生產；Signal Forms 進入開發者預覽；新的 `resource()` API 為聲明式異步數據管理提供了原生支持。"
wordCount: 331
---

Angular 20 於 2025 年 5 月正式發佈。這是 Angular 自 2022 年開始"Signal 化轉型"以來最重要的里程碑——Zoneless 變更檢測正式穩定，可用於生產；Signal Forms 進入開發者預覽；新的 `resource()` API 為聲明式異步數據管理提供了原生支持。

## 重大變化：zone.js 不再是默認依賴

新建 Angular 20 項目時，`zone.js` **不再默認包含在 polyfills 中**：

```bash
# 創建新的 Angular 20 項目
ng new my-app
# 選項：Would you like to use zoneless? (y/N) → 默認 y（推薦）
```

```json
// angular.json（Angular 20 新項目）
{
  "build": {
    "options": {
      "polyfills": [] // 無 zone.js，體積減少 ~13KB gzip
    }
  }
}
```

遷移老項目時，如果暫時不想移除 zone.js，可以保持原配置不變（向後兼容）。

## Zoneless 在生產環境的實踐

Zoneless 模式下，所有狀態更新必須通過 Signal 或顯式標記 `markForCheck()` 觸發 UI 更新：

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>消息數量：{{ messageCount() }}</p>
    <button (click)="send()">發送</button>
  `,
})
export class ChatComponent {
  private messages = signal<Message[]>([]);
  messageCount = computed(() => this.messages().length);

  // ✅ 直接修改 Signal → 自動觸發 UI 更新（無需 zone.js）
  send() {
    this.messages.update((msgs) => [...msgs, createMessage()]);
  }

  // ✅ 第三方 WebSocket 回調（非 Angular zone）→ 用 signal.set() 更新
  private setupWs() {
    const ws = new WebSocket("/ws");
    ws.onmessage = (evt) => {
      // 直接 .update() 即可，Angular 20 Zoneless 會檢測到變化
      this.messages.update((msgs) => [...msgs, JSON.parse(evt.data)]);
    };
  }
}
```

## Signal Forms 開發者預覽

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
          <small>至少 {{ err.requiredLength }} 個字符</small>
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

注意：Signal Forms 是**開發者預覽**，API 在未來版本可能調整。舊的 `ReactiveFormsModule` 和 `FormsModule` 繼續完全支持。

## resource() API：聲明式異步資源

```typescript
import { resource, signal, computed } from '@angular/core';

@Component({ standalone: true, ... })
export class ProductListComponent {
  category = signal<string>('all');
  page = signal(1);

  // resource 自動管理加載/錯誤/成功狀態
  products = resource({
    request: computed(() => ({ category: this.category(), page: this.page() })),
    loader: async ({ request }) => {
      const res = await fetch(`/api/products?cat=${request.category}&page=${request.page}`);
      return res.json() as Promise<Product[]>;
    }
  });

  // 手動刷新
  refresh() {
    this.products.reload();
  }
}
```

模板中直接訪問狀態：

```html
@if (products.isLoading()) {
<skeleton-list />
} @else if (products.error()) {
<error-view (retry)="refresh()" />
} @else { @for (product of products.value()!; track product.id) {
<product-card [product]="product" />
} }
```

## 與 Angular 19 的主要差異

```
Angular 19              Angular 20
────────────────────────────────────────────────
Zoneless: 開發者預覽    → 正式穩定
Signal Forms: 無        → 開發者預覽
resource(): 無          → 實驗性（RC）
OnPush 默認: 否         → 新項目默認是
zone.js: 默認包含       → 新項目默認不包含
```

## 總結

Angular 20 是 Angular 2022-2025 轉型路線圖的"交付年"。對於已經在用 Angular 17-19 的團隊，今年可以開始認真評估 Zoneless 遷移路徑，並試用 Signal Forms 開發者預覽。Angular 的響應式模型正變得更接近現代 JS 生態的習慣——Signal 作為統一的狀態基本單元。
