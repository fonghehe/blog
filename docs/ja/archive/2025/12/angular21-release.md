---
title: "Angular 21 正式リリース：Signal Forms 安定化、Signal化転換完了"
date: 2025-12-17 15:31:08
tags:
  - Angular
readingTime: 3
description: "Angular 21 は2025年11月19日に正式リリースされました。これは Angular が2022年に開始した「Signal 化変革」以来、最もマイルストーンとなるバージョンです——Signal Forms が正式に安定化し、Angular コンポーネントのすべての核心 API（入力、出力、クエリ、変更検出、フォーム）が完全に Signal 化されたことを意味します。"
wordCount: 525
---

Angular 21 は 2025 年 11 月 19 日に正式リリースされました。これは Angular が 2022 年に開始した「Signal 化変革」以来、最もマイルストーンとなるバージョンです——Signal Forms が正式に安定化し、Angular コンポーネントのすべての核心 API（入力、出力、クエリ、変更検出、フォーム）が完全に Signal 化されたことを意味します。Angular の近代化変革は、これでひと区切りがつきました。

## Angular 21 で安定化された API 一覧

```typescript
// 以下 API 在 Angular 21 中正式稳定（不再有任何实验/预览标记）
import {
  // コンポーネント API（18.1 で安定化済み）
  input, input.required,
  output, model,
  viewChild, viewChildren,
  contentChild, contentChildren,

  // リアクティブプリミティブ（安定化済み）
  signal, computed, effect,
  linkedSignal,  // 21 で正式に安定化

  // 非同期リソース（21 で安定化）
  resource,
} from '@angular/core';

import {
  // Signal Forms（21 で正式に安定化）
  formGroup, formControl, formArray,
  Validators,
  SignalFormsModule,
} from '@angular/forms';

import {
  // HTTP resource（21 で安定化）
  httpResource,
} from '@angular/core/rxjs-interop';
```

## 完全な Angular 21 Signal コンポーネント

Angular 21 の最新 API をすべて使用したコンポーネント：

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
  changeDetection: ChangeDetectionStrategy.OnPush, // 新規プロジェクトのデフォルト
  template: `
    <!-- スケルトンローディング -->
    @if (userResource.isLoading()) {
      <settings-skeleton />
    }

    <!-- エラー状態 -->
    @else if (userResource.error()) {
      <error-view (retry)="userResource.reload()" />
    }

    <!-- 通常コンテンツ -->
    @else if (userResource.value(); as user) {
      <form [sfGroup]="form" (ngSubmit)="save()">
        <h2>{{ user.displayName }} の設定</h2>

        <input [sfControl]="form.controls.displayName" />
        <input [sfControl]="form.controls.email" type="email" />

        <button [disabled]="!canSave()">
          {{ isSaving() ? "保存中..." : "変更を保存" }}
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

  // httpResource：データ読み込み
  userResource = httpResource<User>(() => `/api/users/${this.userId()}`);

  // Signal Forms
  form = formGroup({
    displayName: formControl("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    email: formControl("", [Validators.required, Validators.email]),
  });

  // データ読み込み完了時にフォームを埋める
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

## 旧 API の非推奨状態

Angular 21 は以下の API に非推奨警告を正式に発行しました（実行には影響しませんが、ビルド時に警告が表示されます）：

```
@Input()/@Output() デコレータ → 引き続きサポートされるが、input()/output() への移行を推奨
FormControl/FormGroup クラス → 引き続きサポートされるが、Signal Forms への移行を推奨
zone.js の新規プロジェクトでの使用 → 非推奨警告（既存プロジェクトは影響を受けない）
```

非推奨は削除を意味しません。Angular チームは少なくとも2つのメジャーバージョン内では削除しないことを約束しています。

## Angular 21 のその他の新機能

**ルーティング Meta の安定化**：

```typescript
// app.routes.ts
{
  path: 'product/:id',
  component: ProductDetailComponent,
  data: { meta: { title: '商品詳細', description: '...' } }
}
// <router-meta /> ディレクティブと組み合わせて <title> と <meta> タグを自動注入
```

**ビルドパフォーマンス**：Angular 21 は Rolldown をオプションのプロダクションビルドバックエンド（実験的）として使用し、より高速なコード分割戦略を初めてサポートします。

## まとめ

Angular 21 は「完成」のバージョンです——3 年にわたる Signal 化変革がこのバージョンでひと区切りつきました。Angular チームとコミュニティにとって、今後は API の再設計ではなく、パフォーマンス（Zoneless の普及、Rolldown 統合）と DX の改善に集中できます。2026 年の Angular 22 は、より安定した基盤の上でさらに前進することが期待されています。
