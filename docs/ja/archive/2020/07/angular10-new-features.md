---
title: "Angular 10 新機能：TypeScript 3.9とストリクトモード設定"
date: 2020-07-17 09:48:23
tags:
  - Angular
readingTime: 2
description: "Angular 10 于 2020 年 6 月 24 日正式发布，距离 Angular 9 仅约 4 个月。这次版本主要聚焦于**质量和生态健康**：更严格的 TypeScript 配置、废弃旧版依赖、修复大量 bug。"
wordCount: 530
---

Angular 10 は 2020 年 6 月 24 日に正式リリースされ、Angular 9 からわずか約 4 ヶ月後のリリースとなった。今回のバージョンは主に**品質とエコシステムの健全性**に焦点を当てている。より厳格な TypeScript 設定、旧来の依存関係の廃止、そして多数のバグ修正だ。

## 新規プロジェクトでストリクトモードがデフォルトに

Angular 10 CLI は新規プロジェクト作成時に strict モードのオプションを提供する：

```bash
ng new my-app --strict
```

strict モードは `tsconfig.json` と `angular.json` で一連の設定を有効化する：

```json
// tsconfig.json（strict 模式）
{
  "compilerOptions": {
    "strict": true, // TS 严格模式
    "noImplicitOverride": false,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true // 模板严格检查（Angular 9 引入）
  }
}
```

```json
// angular.json（strict 模式下的 budget 配置更严格）
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500kb",   // 之前是 2mb
    "maximumError": "1mb"        // 之前是 5mb
  }
]
```

## TypeScript 3.9 サポート

Angular 10 は TypeScript 3.9 を要件としており、いくつかの実用的な改善がもたらされた：

**`// @ts-expect-error` 注释**

```typescript
// 之前：用 @ts-ignore 压制错误（即使代码后来修好了，ignore 还在）
// @ts-ignore
const x: number = "hello";

// TypeScript 3.9：用 @ts-expect-error，如果下一行没有错误会报警告
// @ts-expect-error
const x: number = "hello"; // 有错误，正确
// @ts-expect-error
const y: number = 123; // 没有错误！TS 会提示这个注释是多余的
```

**条件类型推断改进**

```typescript
// 3.9 之前，某些联合类型的条件类型推断不正确
type IsString<T> = T extends string ? "yes" : "no";
type Test = IsString<string | number>;
// 3.9 之前：'yes' | 'no'（分布式）
// 3.9：仍然是分布式，但某些边界 case 修复了
```

## レガシー依存関係の非推奨化

Angular 10 では以下の内容が**非推奨**（Angular 12 で削除予定）となった：

- `ViewEncapsulation.Native` → 使用 `ViewEncapsulation.ShadowDom`
- `ModuleWithProviders` 的非泛型形式
- `ActivatedRoute` 的部分废弃属性
- 对 IE 9、10 和 IE Mobile 的支持

```typescript
// ❌ 废弃
@Component({
  encapsulation: ViewEncapsulation.Native
})

// ✅ 替代
@Component({
  encapsulation: ViewEncapsulation.ShadowDom
})
```

## 日付範囲ピッカー (Material UI)

Angular 10 は Angular Material に日付範囲選択（date range picker）を新たに追加した：

```html
<mat-date-range-input [rangePicker]="picker">
  <input matStartDate placeholder="开始日期" />
  <input matEndDate placeholder="结束日期" />
</mat-date-range-input>
<mat-date-range-picker #picker></mat-date-range-picker>
```

```typescript
form = this.fb.group({
  dateRange: this.fb.group({
    start: [null],
    end: [null],
  }),
});
```

## Angular 9 からのアップグレード

```bash
ng update @angular/core@10 @angular/cli@10

# 如果有 Material UI
ng update @angular/material@10
```

主なマイグレーションの内容は以下の通り：

1. `ViewEncapsulation.Native` → `ShadowDom` の警告を修正する
2. `ModuleWithProviders<T>` のジェネリック引数を補完する（CLI が自動で処理する）
3. TypeScript を 3.9 に更新する

## まとめ

Angular 10 は機能主導のメジャーバージョンではなく、**エンジニアリング品質主導**のバージョンだ。strict モードがデフォルトで有効になるのは新規プロジェクトにとって非常に良い実践だ。最初から正しい型の習慣を身につけるほうが、後から移行するよりもコストがずっと低い。
