---
title: "Angular 19.2 プレビュー：Signal-based Forms 開発者プレビューとルーティング改善"
date: 2025-01-31 10:00:00
tags:
  - Angular
readingTime: 3
description: "Angular 19.2は2025年2月のリリースが予定されています。公開されているRFCとGitHub PRから、事前に把握しておく価値のある2つの方向性が見えています。**Signal-based Formsの開発者プレビュー入り**と、ルートの遅延ローディングのさらなる改善です。本記事は現在のRCとコミュニティの"
wordCount: 521
---

Angular 19.2は2025年2月のリリースが予定されています。公開されているRFCとGitHub PRから、事前に把握しておく価値のある2つの方向性が見えています。**Signal-based Formsの開発者プレビュー入り**と、ルートの遅延ローディングのさらなる改善です。本記事は現在のRCとコミュニティの議論をもとに、間もなくやってくる変更をプレビューします。

> 本記事はAngular 19.2 RCと公開RFCに基づいており、正式リリース時に差異が生じる可能性があります。

## Signal-based Forms の草案

Angularの`ReactiveFormsModule`（FormControl、FormGroup、FormArray）はRxJS Observableをベースに構築されており、Signalのエコシステムとはなじみにくい状況にあります。Angularチームは全く新しいSignal-based Forms APIを設計中です。

```typescript
// 現在（ReactiveFormsModule、RxJS ベース）
import { FormControl, FormGroup, Validators } from "@angular/forms";

const form = new FormGroup({
  name: new FormControl("", [Validators.required, Validators.minLength(2)]),
  email: new FormControl("", [Validators.required, Validators.email]),
});

// 変更に反応するには subscribe または valueChanges Observable が必要
form.valueChanges.subscribe((val) => console.log(val));
```

```typescript
// プレビュー（Signal-based Forms、19.2 開発者プレビュー草案）
import { formGroup, formControl, Validators } from "@angular/forms/signal"; // 新パッケージパス TBD

const form = formGroup({
  name: formControl("", {
    validators: [Validators.required, Validators.minLength(2)],
  }),
  email: formControl("", {
    validators: [Validators.required, Validators.email],
  }),
});

// Signal：値を直接読み取れる（subscribe 不要）
console.log(form.value()); // Signal<{ name: string; email: string }>
console.log(form.valid()); // Signal<boolean>
console.log(form.dirty()); // Signal<boolean>

// テンプレートでのバインディング
// [formControl]="nameControl" は新しい Signal ディレクティブに置き換え（TBD）
```

テンプレートでの使用：

```html
<!-- 新 Signal Forms テンプレートバインディング（草案、APIは未確定）-->
<form (ngSubmit)="submit()">
  <input [signalControl]="form.controls.name" />
  <span *ngIf="form.controls.name.errors()?.['required']">名前は必須です</span>

  <input type="email" [signalControl]="form.controls.email" />
  <span *ngIf="form.controls.email.errors()?.['email']"
    >メールアドレスの形式が正しくありません</span
  >

  <button [disabled]="!form.valid()">送信</button>
</form>
```

主な利点：

```typescript
// computed() とシームレスに統合
const submitEnabled = computed(() => form.valid() && !isSubmitting());

// effect() 内でフォームの変更に反応できる
effect(() => {
  if (form.value().email) {
    preloadUserSuggestions(form.value().email);
  }
});
```

## ルート遅延ローディングの改善：defer とルートの組み合わせ

Angular 19.2では`@defer`とルートの遅延ローディングを組み合わせることを探求しています。

```typescript
// 現在：ルートの遅延ローディング（モジュールレベル）
const routes: Routes = [
  {
    path: "dashboard",
    loadComponent: () =>
      import("./dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
  },
];

// 19.2 の探求：ルートコンポーネント内の @defer ブロックもルートのプリロード戦略に参加
// つまり：ルートに入ったとき、可視コンテンツのみ読み込み、スクロール時にオンデマンドで読み込む
```

## サーバーサイドレンダリングのパフォーマンス改善

Angular 19.2はSSRのTransfer Stateの仕組みを改善しました。

```typescript
// 改善前：すべての HTTP リクエスト結果が Transfer State にシリアライズされていた（データが大きい可能性）
// 改善後：選択的 Transfer をサポート（必要なデータのみ転送）

@Injectable({ providedIn: "root" })
export class ApiService {
  private http = inject(HttpClient);

  getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`, {
      // 19.2 新機能：Transfer State 不要のマーク
      context: new HttpContext().set(SKIP_TRANSFER_STATE, true),
    });
  }
}
```

## 開発者ツールの改善

Angular DevToolsは19.2でSignalトレーシングビューを追加します。

```
Angular DevTools 19.2 新機能：
- Signal 依存グラフの可視化：どの Signal がどの computed/effect に影響しているか確認可能
- インクリメンタルハイドレーション状態モニター：どの @defer ブロックがハイドレーション済みかを確認
- Zoneless パフォーマンス分析：zone.js ありなしの変更検出回数を比較
```

## 19.2へのアップグレード方法（リリース後）

```bash
ng update @angular/core@19.2 @angular/cli@19.2

# Signal Forms API の確認（リリース後）
ng add @angular/forms@19.2
```

## まとめ

Angular 19.2で最も期待されているのはSignal-based Forms——Angularのフォームシステムにおける過去最大のモダン化の試みです。開発者プレビューに入れば、Signal Inputs/Outputs/Queriesと組み合わせて、Angularコンポーネント全体のAPIが「デコレータ + Observable」という歴史的な負の遺産から完全に解放されます。今年はAngularのフォームシステムの転換の年として、注目に値します。
