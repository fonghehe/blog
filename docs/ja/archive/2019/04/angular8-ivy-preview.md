---
title: "Angular 8 RCプレビュー：IvyコンパイラとLazy Loadingの新構文"
date: 2019-04-11 16:09:56
tags:
  - Angular
readingTime: 3
description: "Angular 8の最初のRCがリリースされ、期待されていた2つの機能が追加されました：オプトインのIvyコンパイラプレビューと`import()`による遅延ロード構文です。"
wordCount: 686
---

Angular 8の最初のRCがリリースされ、期待されていた2つの機能が追加されました：オプトインのIvyコンパイラプレビューと`import()`による遅延ロード構文です。

## Ivyとは

IvyはAngularの次世代レンダリングエンジンです。コンパイラとランタイムを書き直し、以下の目標を掲げています：

- **より小さなバンドルサイズ**：tree-shakingに適した設計で、実際に使用するフレームワーク機能のみをバンドル
- **より速いリビルド**：インクリメンタルコンパイルにより、1ファイルの変更でプロジェクト全体を再コンパイルする必要がない
- **より良いデバッグ体験**：読みやすいレンダラーコード
- **将来的な機能サポート**：Server-Side Rendering、Higher-order componentsなどの高度な機能

## Ivyプレビューの有効化

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

注意：Angular 8のIvyは**オプトイン**プレビューのみであり、本番環境でのテストは推奨されません。デフォルトで完全に有効になるのはAngular 9からです。

## 遅延ロード構文の変更

これはAngular 8の**非常に実用的な**変更です。以前は文字列でモジュールパスを指定していたため型チェックがありませんでしたが、ネイティブのES `import()`構文を使用することで、コンパイラがパスの正確性をチェックできるようになりました：

```typescript
// Angular 7以前：文字列パス
const routes: Routes = [
  {
    path: "users",
    loadChildren: "./users/users.module#UsersModule", // 旧構文
  },
];

// Angular 8+：動的import()
const routes: Routes = [
  {
    path: "users",
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
];
```

新構文のメリット：

1. IDEがパスを追跡し、リネーム時に自動更新
2. TypeScriptがコンパイル時にパスの存在を確認
3. より読みやすい——対応関係が一目瞭然

## Web Workerサポート

Angular 8 CLIはワンコマンドでWeb Workerを生成できます：

```bash
ng generate web-worker app
```

```typescript
// src/app/app.worker.ts
onmessage = ({ data }) => {
  const result = heavyComputation(data);
  postMessage(result);
};

// コンポーネントでの使用
if (typeof Worker !== "undefined") {
  const worker = new Worker("./app.worker", { type: "module" });
  worker.postMessage({ input: largeData });
  worker.onmessage = ({ data }) => {
    this.result = data;
  };
}
```

## Differential Loading（差分ローディング）

Angular 8でデフォルト有効：モダンブラウザはES2015+バンドルを、レガシーブラウザはES5バンドルを読み込みます。

```html
<!-- ビルド後に自動生成 -->
<script type="module" src="main-es2015.js"></script>
<!-- モダンブラウザ -->
<script nomodule src="main-es5.js"></script>
<!-- レガシーブラウザのフォールバック -->
```

モダンブラウザのユーザーは**20〜30%のサイズ削減**（ポリフィルやES5トランスパイルのオーバーヘッドなし）を享受できます。

## まとめ

Angular 8はIvy、新しい遅延ロード構文、Web Workerサポート、Differential Loadingにより、大きな前進を遂げました。これらの変更はAngularエコシステムの将来の基盤を作るものです。
