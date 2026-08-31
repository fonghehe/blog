---
title: "Angular 12 新機能：Ivy 単独化、Webpack 5 デフォルト化、Sass アップグレード"
date: 2021-07-30 10:56:08
tags:
  - Angular
  - Webpack
  - TypeScript

readingTime: 3
description: "Angular 12 于 2021 年 5 月 26 日正式发布。这是一个里程碑版本：View Engine 正式退场，Ivy 成为唯一渲染引擎；Webpack 5 从实验性升级为默认构建工具。升级之后我们整理了一份完整的变化记录。"
wordCount: 851
---

Angular 12 は 2021 年 5 月 26 日に正式リリースされた。View Engine が正式に姿を消し、Ivy が唯一のレンダリングエンジンになったのが象徴的な節目だ。また Webpack 5 が実験的扱いからデフォルトのビルドツールへと昇格した。アップグレード後に、変更点をまとめた記録をここに残す。

## View Engine の廃止

Angular 12 では `@angular/compiler` に View Engine が含まれなくなり、`ngcc` も不要になった（すべてのライブラリが Ivy 形式で公開されているため）。

**開発者への影響**：

- Angular 12 へアップグレードすると、プロジェクトのすべての依存関係が Ivy 互換である必要がある
- Angular 9 以降に更新されていない古いサードパーティ製ライブラリを使うとエラーになる可能性がある
- `enableIvy: false` の設定は無効になる

## Webpack 5 が正式にデフォルトに

```bash
# Angular 12 之前
ng new my-app  # 使用 Webpack 4

# Angular 12 之后
ng new my-app  # 使用 Webpack 5（持久化缓存默认开启）
```

**永続キャッシュの実際の効果**（中規模プロジェクトでの検証）：

```
首次 ng serve：28s
第二次 ng serve（无代码变化）：4s  ← 持久化缓存命中
修改一个组件后 ng serve：6s  ← 增量重建
```

永続キャッシュは `.angular/cache` ディレクトリに保存されるため、`.gitignore` への追加を推奨する：

```bash
echo ".angular/cache" >> .gitignore
```

## strictTemplates が新規プロジェクトのデフォルトに

Angular 12 以降、すべての新規プロジェクトで `strictTemplates` がデフォルトで有効になり、`--strict` フラグは不要になった：

```json
// tsconfig.json（Angular 12 新项目默认配置）
{
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

## Sass API の更新（重要！）

Angular 12 では Sass のサポートが強化され、旧来の Node Sass API が非推奨となり、Dart Sass のモダンな API が採用された：

```bash
# 之前：需要 node-sass（C++ 依赖，安装麻烦）
npm install node-sass

# Angular 12：sass（纯 JS 实现）
npm install sass
```

**古い Sass の書き方からの移行**：

```scss
// ❌ 旧 API（已废弃）
@import "variables"; // 使用 @import

// ✅ 新 API
@use "variables" as v;
@use "mixins";

.button {
  color: v.$primary-color; // 使用命名空间
  @include mixins.flex-center;
}
```

`@use` が `@import` に代わる利点は、グローバルスコープの汚染を防ぎ、各ファイルが依存関係を明示的に宣言できる点だ。

## Inline Sass（インラインスタイルのサポート）

Angular 12 の CLI では、コンポーネント内で Sass 構文を使ってインラインスタイルを書ける：

```typescript
@Component({
  selector: "app-button",
  template: `<button class="btn">点击</button>`,
  styles: [
    `
      $primary: #0066ff;
      .btn {
        background: $primary;
        &:hover {
          background: darken($primary, 10%);
        }
      }
    `,
  ],
})
export class ButtonComponent {}
```

## ng build のデフォルトが本番モードに

```bash
# Angular 12 之前
ng build           # 开发模式
ng build --prod    # 生产模式（需要显式指定）

# Angular 12 之后
ng build           # 生产模式（默认！）
ng build --configuration development  # 开发模式
```

この変更により、「`--prod` を付け忘れて開発版を公開してしまう」という事故を防げる。

## Angular 12 へのアップグレード

```bash
ng update @angular/core@12 @angular/cli@12

# 主要迁移内容（CLI 自动处理）：
# 1. 更新 tsconfig 中废弃的选项
# 2. 迁移 ng build 默认配置
# 3. 更新 Sass 相关配置
```

**注意**：Ivy に対応していないサードパーティ製ライブラリに依存していると、アップグレードが失敗する可能性がある。まず `ng update --list` で確認しよう：

```bash
ng update --list
# 会列出哪些包需要先升级
```

## まとめ

Angular 12 の変更のなかで、最も象徴的なのは View Engine の退場──Ivy の時代が本格的に始まったことを意味する。Webpack 5 のデフォルト化でインクリメンタルビルドの速度は倍になり、`ng build` のデフォルト本番モードはよくあるデプロイ事故の一種を排除した。このアップグレードは大半のプロジェクトにとって低リスクであり、できるだけ早く追従することを推奨する。
