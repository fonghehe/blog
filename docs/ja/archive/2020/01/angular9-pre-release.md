---
title: "Angular 9 RCプレビュー：Ivyのデフォルト化とstrictTemplatesの詳解"
date: 2020-01-28 10:12:20
tags:
  - Angular
readingTime: 3
description: "Angular 9 は RC フェーズの最終段階に入り、正式版は 2020 年 2 月にリリースされる予定です。Angular 8 で Ivy が opt-in のみであったのに対し、Angular 9 では Ivy がデフォルトのレンダリングエンジンとなり、AOT コンパイルもデフォルトモードになります。RC 期間中にこれらの変更を事前に把握しておくことは非常に価値があります。"
wordCount: 761
---

Angular 9 の RC 段階は最終段階に入り、正式版は 2020 年 2 月にリリースされる予定です。Angular 8 では Ivy が opt-in のみであったのに対し、Angular 9 では Ivy がデフォルトのレンダリングエンジンとなり、AOT コンパイルもデフォルトモードになります。RC 期間中にこれらの変更を事前に把握しておくことは非常に価値があります。

## なぜIvyは質的な飛躍なのか

従来の View Engine は `.ngfactory.ts` ファイルを生成し、コンパイル結果がフレームワークコードと強く結合していたため、ツリーシェイキングの効果が低かったです。Ivy の核となる考え方は**レンダリング命令（instructions）をコンポーネントクラスに直接埋め込む**ことです：

```typescript
// View Engine コンパイル後（簡略化）
// user.component.ngfactory.ts（追加で生成されるファイル）
export function View_UserComponent_0(...) { ... }
export const RenderType_UserComponent = ...;

// Ivy コンパイル後（コンポーネントに埋め込み）
export class UserComponent {
  static ɵcmp = defineComponent({
    type: UserComponent,
    selectors: [['app-user']],
    template: function UserComponent_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵelementStart(0, 'div');
        ɵɵtext(1);
        ɵɵelementEnd();
      }
      if (rf & 2) {
        ɵɵadvance(1);
        ɵɵtextInterpolate(ctx.name);
      }
    }
  });
}
```

結果：使用されていないフレームワーク機能（`@Pipe` や一部の CDK ツールなど）は、バンドルに含まれなくなります。

## AOTが開発モードのデフォルトに

従来は開発モードで JIT（高速だが厳密でない）、本番で AOT（遅いが正確）を使用していました。これにより「ローカルではテストが通るのに、本番でエラーが出る」という古典的な問題が発生していました：

```bash
# Angular 8：開発は JIT、build --prod でのみ AOT
ng serve            # JIT
ng build --prod     # AOT

# Angular 9：両方のモードで AOT
ng serve            # AOT（より多くのコンパイル時エラーを検出）
ng build --prod     # AOT
```

## strictTemplatesによるテンプレート厳格チェック

これは RC 期間中に最も事前に把握しておく価値のある設定です。有効にすると、テンプレート内の型エラーがビルド時に報告されます：

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

### よく検出されるエラー

**1. @Input 型の不一致**

```typescript
// コンポーネント定義
@Input() count: number;

// テンプレート
<app-counter [count]="'hello'"></app-counter>
// strictTemplates: error TS2322: Type 'string' is not assignable to type 'number'
```

**2. 存在しないプロパティへのアクセス**

```html
{% raw %}
<!-- user の型は { name: string } であり、age は存在しない -->
<p>{{ user.age }}</p>
<!-- strictTemplates: error - Property 'age' does not exist -->
{% endraw %}
```

**3. \*ngIf 後の型の絞り込み**

```html
{% raw %}
<!-- strictTemplates では TypeScript の型絞り込みが正しく機能 -->
<div *ngIf="user">
  {{ user.name }}
  <!-- user はここで非 null と推論される -->
</div>
{% endraw %}
```

## 移行時の注意点

**ViewChild に static オプションが必要**

RC では `@ViewChild` と `@ContentChild` に `static` を明示的に宣言する必要があります：

```typescript
// ngOnInit で使用 → static: true
@ViewChild('myEl', { static: true }) myEl: ElementRef;

// ngAfterViewInit で使用（または条件付き表示）→ static: false
@ViewChild('myEl', { static: false }) myEl: ElementRef;
```

**サードパーティ製ライブラリの互換性**

Ivy は `ngcc`（Angular Compatibility Compiler）を使用して、インストール時に Ivy 対応していないライブラリを自動変換します。ほとんどの場合は自動処理されますが、問題が発生した場合は手動で実行できます：

```bash
node_modules/.bin/ngcc
```

## まとめ

Angular 9 の2つの核心的な変更——Ivy のデフォルト有効化 + AOT 開発モードのデフォルト化——により、「ローカルでは動くのに本番でエラー」が過去のものになります。今、RC 段階から strictTemplates のエラーに慣れておくことで、正式リリース後のアップグレードでトラブルを減らせます。
