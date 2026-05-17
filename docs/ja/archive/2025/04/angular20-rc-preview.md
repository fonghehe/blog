---
title: "Angular 20 RC プレビュー：安定したゾーンレス、シグナルフォーム、新しいルーターAPI"
date: 2025-04-11 10:00:00
tags:
  - Angular
  - CSS
  - JavaScript
readingTime: 3
description: "Angular 20 リリース候補版が2025年4月上旬に公開され、安定版は5月に予定されています。Angular 20はAngular 19（2024年11月）に続くメジャーバージョンで、過去2年間に蓄積されたSignalベースの機能を完全に安定化させ、「ゾーンフリーAngular」への扉を開くことを核心目標としてい"
---

Angular 20 リリース候補版が2025年4月上旬に公開され、安定版は5月に予定されています。Angular 20はAngular 19（2024年11月）に続くメジャーバージョンで、過去2年間に蓄積されたSignalベースの機能を完全に安定化させ、「ゾーンフリーAngular」への扉を開くことを核心目標としています。

> 本記事はAngular 20 RCに基づいています。最終的なAPIは多少異なる場合があります。

## ゾーンレス変更検知：開発者プレビューから安定版へ

Angular 19のゾーンレスは開発者プレビューでしたが、Angular 20では安定版APIに昇格します：

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

同時に、`zone.js` は新規プロジェクトのデフォルトpolyfillsから削除されます：

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

**バンドルサイズの改善**：zone.jsを削除することで約33 KB（gzip圧縮後約13 KB）が節約され、低スペックデバイスや低速ネットワーク環境で実際の違いが生まれます。

## シグナルフォーム 開発者プレビュー

Signalベースのフォームが Angular 20 で開発者プレビューに入ります：

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

## 新しいルーター：resource() API 統合

Angular 20 は `resource()` API（実験的）を導入し、コンポーネント内で宣言的な非同期リソース管理を可能にし、ルーターと深く統合します：

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

テンプレートでの使用：

```html
@if (userResource.isLoading()) {
<loading-spinner />
} @else if (userResource.error()) {
<error-message [error]="userResource.error()!" />
} @else if (userResource.value(); as user) {
<user-profile [user]="user" />
}
```

## OnPushが新規プロジェクトのデフォルトに

Angular 20 CLIで生成されるコンポーネントは、Signalsと組み合わせて `OnPush` 変更検知がデフォルトになります：

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

## Angular 20 RCへのアップグレード

```bash
ng update @angular/core@20-rc @angular/cli@20-rc

# 自动迁移：将 zone.js 相关配置更新
# 查看迁移列表
ng update @angular/core@20-rc --dry-run
```

## 総括

Angular 20 は近年で最も大きな変化をもたらすメジャーリリースです。安定したゾーンレス変更検知により「zone.jsなしのAngular」が本番環境で真に利用可能になり、シグナルフォームの開発者プレビューは現代的なフォームシステムへの移行の始まりを告げ、`resource()` APIは宣言的な非同期データ管理のギャップを埋めます。Angularチームにとって、これは2022年にSignal変換が始まって以来最も重要なマイルストーンリリースです。
