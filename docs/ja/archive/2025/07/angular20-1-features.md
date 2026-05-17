---
title: "Angular 20.1：resource() API の改善と Signal Forms の進捗"
date: 2025-07-02 10:00:00
tags:
  - Angular
  - JavaScript
readingTime: 2
description: "Angular 20.1 は 2025 年 6 月末にリリースされ、Angular 20 の機能ロードマップを継続しています。本バージョンの焦点は `resource()` API の改善（実験的から開発者プレビューへの昇格）と、Signal Forms の安定化の推進です。"
---

Angular 20.1 は 2025 年 6 月末にリリースされ、Angular 20 の機能ロードマップを継続しています。本バージョンの焦点は `resource()` API の改善（実験的から開発者プレビューへの昇格）と、Signal Forms の安定化の推進です。

## resource() API が開発者プレビューに昇格

Angular 20 で導入された `resource()` は、20.1 で API 調整を経て開発者プレビューに移行しました：

```typescript
import { resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({ standalone: true, ... })
export class UserListComponent {
  private http = inject(HttpClient);

  searchQuery = signal('');
  currentPage = signal(1);

  // httpResource：HttpClient 向けに最適化された resource バリアント（20.1 新追加）
  usersResource = httpResource<User[]>(() =>
    `/api/users?q=${this.searchQuery()}&page=${this.currentPage()}`
  );

  // または汎用 resource（任意の非同期ロジックをサポート）
  statsResource = resource({
    request: this.currentPage,
    loader: async ({ request: page, abortSignal }) => {
      // 20.1 新追加：AbortSignal サポート——リクエスト切替時に前のリクエストを自動キャンセル
      const res = await fetch(`/api/stats?page=${page}`, { signal: abortSignal });
      return res.json() as Promise<Stats>;
    }
  });
}
```

### httpResource：Angular HTTP 向けに最適化

```typescript
import { httpResource } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class ProductDetailComponent {
  productId = input.required<string>();

  // httpResource は自動的に：
  // 1. Angular の HTTP インターセプターチェーンを処理
  // 2. SSR で Transfer State を書き込み/読み取り
  // 3. withCredentials、headers などの設定をサポート
  product = httpResource<Product>(() => ({
    url: `/api/products/${this.productId()}`,
    headers: { 'Accept-Language': 'ja-JP' }
  }));
}
```

## Signal Forms：バリデーターの強化

Angular 20.1 は Signal Forms に非同期バリデーターのサポートを追加しました：

```typescript
import { formControl, Validators, asyncValidator } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// 非同期バリデーター：ユーザー名の一意性チェック
const usernameUniqueValidator = asyncValidator(async (value: string) => {
  if (!value) return null;
  const exists = await checkUsernameExists(value);
  return exists ? { taken: { value } } : null;
});

@Component({ standalone: true, ... })
export class RegisterComponent {
  form = formGroup({
    username: formControl('', {
      validators: [Validators.required, Validators.minLength(3)],
      asyncValidators: [usernameUniqueValidator]
    }),
    email: formControl('', [Validators.required, Validators.email]),
  });

  // 新追加：pending() Signal——非同期バリデーションが進行中かどうか
  isValidating = computed(() =>
    Object.values(this.form.controls).some(c => c.pending())
  );
}
```

テンプレート内：

```html
<input [sfControl]="form.controls.username" />
@if (form.controls.username.pending()()) {
<small>ユーザー名の利用可否を確認中...</small>
} @if (form.controls.username.hasError('taken')()) {
<small>このユーザー名はすでに使用されています</small>
}
```

## インクリメンタルハイドレーション：hydrate on timer

Angular 20.1 は `hydrate on timer` トリガー条件を追加しました：

```html
<!-- ページ読み込みから 3 秒後にハイドレーション（低優先度の広告/おすすめコンテンツに最適）-->
@defer (hydrate on timer(3000)) {
<recommendation-sidebar />
}

<!-- 複合条件：ビューポートに入り、かつアイドル時のみハイドレーション -->
@defer (hydrate on viewport; hydrate when isLoggedIn()) {
<user-personalized-feed />
}
```

## DevTools の更新

Angular DevTools 20.1 に resource 追跡機能が追加されました：

```
新しいパネル：Resources
- 現在アクティブなすべての resource() インスタンスを表示
- ステータス：loading / success / error
- 最終読み込み時刻
- リクエストパラメーターのスナップショット
- 手動リロードボタン
```

## まとめ

Angular 20.1 の核心的な進展は `resource()` エコシステムの成熟です——`httpResource()` により Angular HTTP が新しい宣言的データフローパターンとシームレスに統合され、非同期バリデーターにより Signal Forms が本番に必要な完全な機能を備えました。Angular のリリースサイクルに従い、20.2（8 月）と 21（11 月）でこの体系がさらに改善される予定です。
