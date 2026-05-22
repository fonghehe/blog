---
title: "Angular 13 リリース：View Engine の残骸削除と APF 再設計"
date: 2021-12-17 16:44:32
tags:
  - Angular
  - TypeScript

readingTime: 3
description: "Angular 13 は2021年11月3日に正式リリースされました。このバージョンの最大の意義は歴史的な負債を徹底的に排除したことです。View Engine 関連コードの完全削除、IE 11 サポートの廃止、Angular Package Format（APF）の再設計。すでに Ivy 上で安定して動作しているプロジェクトにとって、このアップグレードはより小さな依存関係とより高速なビルドをもたらします。"
wordCount: 771
---

Angular 13 は2021年11月3日に正式リリースされました。このバージョンの最大の意義は**歴史的な負債を徹底的に排除したこと**です：View Engine 関連コードの完全削除、IE 11 サポートの廃止、Angular Package Format（APF）の再設計。すでに Ivy 上で安定して動作しているプロジェクトにとって、このアップグレードはより小さな依存関係とより高速なビルドをもたらします。

## View Engine の完全削除

Angular 12 で View Engine が非推奨となり、Angular 13 で関連コードが**完全に削除**されました：

- `@angular/compiler` の View Engine コンパイルロジックを削除
- `ngfactory` および `ngsummary` ファイルを生成しない
- `TestBed` が `compileComponents()` を呼び出さなくなる（非同期コンパイル）：

```typescript
// Angular 13 以前：TestBed は async compileComponents が必要
beforeEach(async () => {
  await TestBed.configureTestingModule({
    declarations: [MyComponent],
  }).compileComponents(); // コンパイルを待つ必要がある
});

// Angular 13：await compileComponents は不要（Ivy は同期）
beforeEach(() => {
  TestBed.configureTestingModule({
    declarations: [MyComponent],
  });
  // 直接使用可能、async は不要
});
```

これによりテストコードがより簡潔になり、テストスイートの実行が高速化します。

## IE 11 サポートの完全廃止

Angular 13 は IE 11 向けの追加 polyfill や互換コードを生成しません：

```json
// angular.json - Angular 13 の新規プロジェクトには IE 関連の設定はない
// 以前の browserslist 設定（削除済み）：
// IE 11

// .browserslistrc（Angular 13 デフォルト）
last 1 Chrome version
last 1 Firefox version
last 2 Edge major versions
last 2 Safari major versions
last 2 iOS major versions
Firefox ESR
```

**影響**：

- メインバンドルのサイズが約4KB削減（IE 関連の polyfill を除去）
- ビルド速度が向上（ES5 互換コードを生成する必要がない）
- 引き続き IE 11 をサポートする必要がある場合は、**Angular 13 にアップグレードしないでください**

## Angular Package Format（APF）の再設計

APF は Angular ライブラリの npm への公開方法を定義しています。Angular 13 は APF を再設計しました：

```
旧 APF（複雑）：
dist/
  esm2015/      ← ES2015 形式
  esm5/         ← ES5 形式（現在は不要）
  fesm2015/     ← flat ES2015
  fesm5/        ← flat ES5（現在は不要）
  bundles/      ← UMD 形式

新 APF（シンプル）：
dist/
  esm2020/      ← ES2020 形式（モダンブラウザ）
  fesm2020/     ← flat ES2020
  fesm2015/     ← flat ES2015（古い Node.js 互換）
```

ES5 の成果物が削除され、ライブラリの公開サイズが**約25%**削減されました。

## 動的コンポーネント作成APIの簡略化

Angular 13 は `ViewContainerRef.createComponent` の API を簡素化しました：

```typescript
// Angular 13 以前：ComponentFactoryResolver が必要
const factory = this.resolver.resolveComponentFactory(DynamicComponent);
const componentRef = this.viewContainer.createComponent(factory);

// Angular 13：コンポーネントクラスを直接渡す
const componentRef = this.viewContainer.createComponent(DynamicComponent);
componentRef.instance.data = "some data";
```

`ComponentFactoryResolver` は引き続き存在しますが（互換性のため）、非推奨となっており、新しい API の使用が推奨されます。

## inline fonts の改善

Angular 13 の CLI はフォントインライン化戦略を改善し、より多くの Google Fonts 形式をサポートしています：

```html
<!-- Angular 13 のビルド後、フォント CSS がインライン化されます -->
<style>
  @font-face {
    font-family: "Inter";
    src: url("https://fonts.gstatic.com/s/inter/...") format("woff2");
    font-display: swap; /* CLS を最適化 */
  }
</style>
```

`font-display: swap` の自動追加は CLS（Cumulative Layout Shift）指標に良い影響を与えます。

## Angular 13 へのアップグレード

```bash
ng update @angular/core@13 @angular/cli@13

# 主な自動マイグレーション：
# 1. TestBed.compileComponents の async ラッパーを削除
# 2. 非推奨の ComponentFactoryResolver の使用法を移行
# 3. tsconfig の target を ES2020 に更新
```

**アップグレード前の確認**：

```bash
ng update --list
# すべての依存関係に Angular 13 互換バージョンがあることを確認
```

## まとめ

Angular 13 は「掃除型」バージョンです——歴史的な負債を削除し、フレームワークをより軽く、より速くします。View Engine と IE 11 サポートを削除した後、Angular アプリケーションのビルド成果物は平均10-15%削減されます。ユーザーに IE 11 がもういないのであれば、このアップグレードのコストパフォーマンスは非常に高いです。
