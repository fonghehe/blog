---
title: "Angular 20 正式リリース：Zoneless安定化、Signal Forms、resource() API"
date: 2025-05-07 11:41:18
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 3
description: "Angular 20が2025年5月に正式リリースされました。これは2022年に始まった「Signal化への転換」以来、Angularにとって最も重要なマイルストーンです——Zoneless変更検知が正式に安定化して本番利用可能となり、Signal Formsが開発者プレビューに入り、新しい`resource()` A"
wordCount: 495
---

Angular 20が2025年5月に正式リリースされました。これは2022年に始まった「Signal化への転換」以来、Angularにとって最も重要なマイルストーンです——Zoneless変更検知が正式に安定化して本番利用可能となり、Signal Formsが開発者プレビューに入り、新しい`resource()` APIが宣言的な非同期データ管理のネイティブサポートを提供します。

## 重大な変更：zone.jsはデフォルト依存でなくなった

新規Angular 20プロジェクト作成時、`zone.js`は**polyfillsにデフォルトで含まれなくなりました**：

```bash
# 新規Angular 20プロジェクトの作成
ng new my-app
# オプション：Would you like to use zoneless? (y/N) → デフォルトy（推奨）
```

```json
// angular.json（Angular 20新規プロジェクト）
{
  "build": {
    "options": {
      "polyfills": [] // zone.jsなし、約13KB gzip削減
    }
  }
}
```

既存プロジェクトを移行する際、zone.jsをすぐに削除したくない場合は既存の設定を維持できます（後方互換性あり）。

## Zonelessの本番環境における実践

Zonelessモードでは、すべての状態更新はSignalか明示的な`markForCheck()`によるUI更新のトリガーが必要です：

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>メッセージ数：{{ messageCount() }}</p>
    <button (click)="send()">送信</button>
  `,
})
export class ChatComponent {
  private messages = signal<Message[]>([]);
  messageCount = computed(() => this.messages().length);

  // ✅ Signalを直接変更 → UIが自動更新（zone.jsなしでも動作）
  send() {
    this.messages.update((msgs) => [...msgs, createMessage()]);
  }

  // ✅ サードパーティのWebSocketコールバック（Angular zone外）→ signal.set()で更新
  private setupWs() {
    const ws = new WebSocket("/ws");
    ws.onmessage = (evt) => {
      // .update()を直接呼ぶだけでOK。Angular 20 Zonelessが変更を検知する
      this.messages.update((msgs) => [...msgs, JSON.parse(evt.data)]);
    };
  }
}
```

## Signal Forms 開発者プレビュー

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
          <small>ユーザー名は必須です</small>
        }
        @if (form.controls.username.hasError("minlength")(); as err) {
          <small>{{ err.requiredLength }}文字以上必要です</small>
        }
      </div>

      <button [disabled]="form.invalid() || isSubmitting()">
        {{ isSubmitting() ? "送信中..." : "送信" }}
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

注意：Signal Formsは**開発者プレビュー**であり、APIは将来のバージョンで変更される可能性があります。旧来の`ReactiveFormsModule`と`FormsModule`は引き続き完全にサポートされます。

## resource() API：宣言的な非同期リソース

```typescript
import { resource, signal, computed } from '@angular/core';

@Component({ standalone: true, ... })
export class ProductListComponent {
  category = signal<string>('all');
  page = signal(1);

  // resourceがローディング/エラー/成功状態を自動管理
  products = resource({
    request: computed(() => ({ category: this.category(), page: this.page() })),
    loader: async ({ request }) => {
      const res = await fetch(`/api/products?cat=${request.category}&page=${request.page}`);
      return res.json() as Promise<Product[]>;
    }
  });

  // 手動リフレッシュ
  refresh() {
    this.products.reload();
  }
}
```

テンプレートで状態に直接アクセス：

```html
@if (products.isLoading()) {
<skeleton-list />
} @else if (products.error()) {
<error-view (retry)="refresh()" />
} @else { @for (product of products.value()!; track product.id) {
<product-card [product]="product" />
} }
```

## Angular 19との主な差異

```
Angular 19              Angular 20
────────────────────────────────────────────────
Zoneless: 開発者プレビュー → 正式安定化
Signal Forms: なし      → 開発者プレビュー
resource(): なし        → 実験的（RC）
OnPushデフォルト: いいえ → 新規プロジェクトはデフォルトyes
zone.js: デフォルト含む → 新規プロジェクトはデフォルト非含有
```

## まとめ

Angular 20はAngular 2022-2025ロードマップの「デリバリーイヤー」です。Angular 17-19を既に使用しているチームは、今年からZoneless移行パスを真剣に評価し、Signal Formsの開発者プレビューを試すことができます。AngularのリアクティブモデルはモダンなJSエコシステムの慣習に近づいており、Signalが統一的な状態の基本単位となっています。
