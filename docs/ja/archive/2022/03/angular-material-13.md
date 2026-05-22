---
title: "Angular Material 13：MDC ベースコンポーネント移行ガイド"
date: 2022-03-30 10:56:22
tags:
  - Angular
readingTime: 4
description: "Angular Material 13 は Angular 13 とともにリリースされ、Material Design Components for Web（MDC）ベースで再実装されたコンポーネントをもたらしました。このリファクタリングはスタイル調整だけでなく、コンポーネントの DOM 構造や CSS クラス名も変更されたため、移行には一定の注意が必要です。"
wordCount: 800
---

Angular Material 13 は Angular 13 とともにリリースされ、Material Design Components for Web（MDC）に基づいて再実装されたコンポーネントが提供されました。このリファクタリングはスタイルの調整だけでなく、コンポーネントの DOM 構造と CSS クラス名も変更されたため、移行には注意が必要です。

## MDC ベースコンポーネントとは

Angular Material の従来のコンポーネントは独自に実装されており、Google がメンテナンスする `material-components-web` ライブラリとは別のコードでした。Angular Material 13 から、公式が MDC ライブラリですべてのコンポーネントを書き換えました。その利点は次のとおりです：

- Material Design 仕様との同期がより緊密になる
- コンポーネントの動作が他のプラットフォーム（Android、iOS Web）と一致する
- アクセシビリティ（A11y）の改善

## 新旧コンポーネントの共存

Angular Material 13 では **2 セットのコンポーネント** が並行して提供され、異なるモジュールでインポートします：

```typescript
// 旧実装（Legacy）：mat-button などは引き続き使用可能
import { MatButtonModule } from "@angular/material/button"; // 依然是旧実装

// 新 MDC 実装：mdc サブパッケージからインポート
// Angular Material 13 の移行戦略：段階的な置き換え
```

注意：Angular Material 13 のほとんどのコンポーネントはデフォルトで MDC 実装に切り替わっていますが、互換性のための移行期間として Legacy モジュールも提供されています。

## 主な変更：Button

```html
<!-- 旧DOM構造 -->
<button mat-button class="mat-button mat-button-base">
  <span class="mat-button-wrapper">Click me</span>
  <div class="mat-button-ripple mat-ripple"></div>
</button>

<!-- MDC版のDOM構造（よりフラット）-->
<button mat-button class="mat-mdc-button mdc-button">
  <span class="mdc-button__label">Click me</span>
  <span class="mat-mdc-button-ripple"></span>
</button>
```

**CSS カスタマイズの移行**：

```scss
// ❌ 古い CSS オーバーライド（無効）
.mat-button .mat-button-wrapper {
  padding: 0;
}

// ✅ 新しい CSS 変数による方法
.mat-mdc-button {
  --mdc-text-button-label-text-color: #0066ff;
  --mdc-text-button-label-text-size: 14px;
}
```

## テーマシステムの変更

Angular Material 13 では、新しい M3-ready テーマ API が導入されました：

```scss
// angular-theme.scss
@use "@angular/material" as mat;

// パレットを定義
$primary-palette: mat.define-palette(mat.$indigo-palette);
$accent-palette: mat.define-palette(mat.$pink-palette, A200, A100, A400);

// テーマを作成
$theme: mat.define-light-theme(
  (
    color: (
      primary: $primary-palette,
      accent: $accent-palette,
    ),
    typography: mat.define-typography-config(),
    density: 0,
    // Angular Material 13 で追加された density パラメータ
  )
);

// テーマを適用
@include mat.all-component-themes($theme);
```

**Density**（密度）は Angular Material 13 の新しい概念で、コンポーネントのコンパクトさを制御します：

```scss
// density: 0  → 標準サイズ（デフォルト）
// density: -1 → ややコンパクト
// density: -2 → よりコンパクト（データ密度の高い UI に適している）
// density: -3 → 最もコンパクト
$compact-theme: mat.define-light-theme(
  (
    color: (
      ...,
    ),
    density: -2,
  )
);
```

## Form Field の変更

Form Field は最も変更の大きいコンポーネントの一つです：

```html
<!-- appearance="fill"（MDC デフォルト）を使用 -->
<mat-form-field appearance="fill">
  <mat-label>用户名</mat-label>
  <input matInput type="text" [(ngModel)]="username" />
  <mat-error>用户名不能为空</mat-error>
  <mat-hint>请输入 6-20 位字符</mat-hint>
</mat-form-field>

<!-- outline スタイル -->
<mat-form-field appearance="outline">
  <mat-label>密码</mat-label>
  <input matInput type="password" />
  <mat-icon matSuffix>visibility</mat-icon>
</mat-form-field>
```

注意：`appearance="legacy"` と `appearance="standard"` は MDC バージョンで非推奨となりました。`fill` または `outline` の使用を推奨します。

## 移行ツール

Angular Material は自動移行の schematic を提供しています：

```bash
ng update @angular/material@13

# 移行は自動的に：
# 1. インポートパスを更新
# 2. 非推奨の API 呼び出しを更新
# 3. 移行レポートを生成
```

CSS カスタマイズのオーバーライドについては、手動で確認し、CSS 変数を使用するよう変更する必要があります：

```bash
# プロジェクトで影響を受ける可能性のある CSS を確認
grep -r "mat-button-wrapper\|mat-form-field-wrapper" src/
```

## まとめ

Angular Material 13 の MDC 移行は「痛みはあるが価値のある」アップグレードです。プロジェクトに多くの CSS カスタマイズのオーバーライドがある場合は、一つずつ確認する必要があります。しかし、移行後はコンポーネントの A11y サポートがより充実し、テーマシステムがより柔軟になり、Material Design 仕様との整合性も高まります。13→14 へのアップグレード前に MDC 移行を完了し、二重の変更による複雑さを避けることをお勧めします。
