---
title: "Angular 11 新機能：HMRサポートとフォントインライン最適化"
date: 2020-12-05 10:59:50
tags:
  - Angular
readingTime: 3
description: "Angular 11 は 2020 年 11 月 11 日に正式リリースされました。Angular 10 の品質リリースと比較して、Angular 11 では開発体験に関する実質的な改善が多く含まれており、中でも HMR サポートとフォントのインライン化が最も注目すべき 2 つの機能です。"
wordCount: 566
---

Angular 11 は 2020 年 11 月 11 日に正式リリースされました。Angular 10 の「品質リリース」と比較して、Angular 11 では開発体験に関する実質的な改善が多く含まれており、中でも HMR サポートとフォントのインライン化が最も注目すべき 2 つの機能です。

## すぐ使えるHMR

Angular 11 以前は、HMR を有効にするには `main.ts` を手動で修正する必要があり、設定が煩雑でした。現在は CLI パラメータ 1 つで済みます：

```bash
# Angular 11 以前の HMR 設定（煩雑）
# 1. angular.json を修正
# 2. main.ts に module.hot の判定を追加
# 3. @angularclass/hmr をインストール

# Angular 11：ワンライナー
ng serve --hmr

# または angular.json で永続的に有効化
```

```json
// angular.json
{
  "serve": {
    "configurations": {
      "development": {
        "hmr": true
      }
    }
  }
}
```

HMR を有効にすると、コンポーネントのテンプレートやスタイルを変更してもページ全体がリロードされず、該当コンポーネントのみが更新されるため、開発体験が大幅に向上します。

## フォントインライン最適化

Angular 11 CLI はデフォルトで Google Fonts の CSS を HTML にインライン化し、余分なネットワークリクエストを回避します：

```html
<!-- 以前：余分な HTTP リクエストが必要でした -->
<link
  href="https://fonts.googleapis.com/css2?family=Roboto&display=swap"
  rel="stylesheet"
/>

<!-- Angular 11 ビルド後は自動的にインライン化（CSS のみ、フォントファイル自体は CDN から読み込み）-->
<style>
  /* フォント CSS をインライン化し、DNS 解決 + HTTP リクエストを 1 回削減 */
  @font-face {
    font-family: "Roboto";
    src: url("https://fonts.gstatic.com/s/roboto/...") format("woff2");
  }
</style>
```

この最適化は Lighthouse の LCP（最大コンテンツ描画）スコアに良い影響を与えます。

## より厳格なNgModuleの型チェック

```typescript
// Angular 11 では NgModule の declarations に対してより厳格な型チェックが行われます
@NgModule({
  declarations: [
    AppComponent,
    // ❌ Angular 11 以前は、Service を誤って declarations に置いてもすぐにエラーにならなかった
    // UserService  // 今は明確にエラーになる：UserService is not a component/directive/pipe
  ]
})
```

## ルーターの改善：より厳格な型

```typescript
// Angular 11 の Router はより良い型推論を提供します
const routes: Routes = [
  {
    path: "users/:id",
    component: UserDetailComponent,
    resolve: {
      user: UserResolver, // TypeScript が resolve の型をより適切に推論できるようになりました
    },
  },
];
```

## Angular 11へのアップグレード

```bash
ng update @angular/core@11 @angular/cli@11

# 主な移行ポイント：
# 1. Webpack 5（試験的）が Webpack 4 を置き換え
# 2. TypeScript 4.0 サポート（Angular 10 は 3.9）
# 3. IE 9/10 サポートが正式に削除
```

**Webpack 5 の試験的サポート**（Angular 11 では引き続き試験的）：

```javascript
// angular.json（Webpack 5 の試験的サポートを有効化）
{
  "cli": {
    "packageManager": "yarn"
  }
}
// package.json
{
  "resolutions": {
    "webpack": "^5.0.0"
  }
}
```

## TypeScript 4.0 新機能のサポート

Angular 11 は TypeScript 4.0 を完全サポートしており、新しい可変タプル型を使用できます：

```typescript
// TypeScript 4.0 可変タプル型
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];
type Strings = Concat<[string, string], [string]>;
// type Strings = [string, string, string]

// Angular サービスでの実際の応用（パラメータの型推論がより正確に）
function concat<T extends unknown[], U extends unknown[]>(
  arr1: T,
  arr2: U,
): [...T, ...U] {
  return [...arr1, ...arr2];
}
```

## まとめ

Angular 11 の HMR 改善は日々実感できる開発体験の向上であり、フォントのインライン化はゼロコンフィグで行えるパフォーマンス最適化です。既存の Angular 10 プロジェクトにとって、このアップグレードには breaking changes がほとんどなく、アップグレードコストが非常に低いため、早急にアップグレードすることをお勧めします。
