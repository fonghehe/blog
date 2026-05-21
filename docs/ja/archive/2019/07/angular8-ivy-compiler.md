---
title: "Angular 8 Ivy レンダラー：差異化ローディングと Web Worker サポート"
date: 2019-07-31 15:52:46
tags:
  - Angular
readingTime: 2
description: "Angular 8 は2019年5月28日に正式リリースされました。Ivy はオプトイン方式でプレビューとして導入され、差異化ローディングがデフォルトで有効になりました。1ヶ月間使ってみた経験をもとに、アップグレード体験と各機能の実際の効果をまとめます。"
wordCount: 499
---

Angular 8 は2019年5月28日に正式リリースされました。Ivy はオプトイン方式でプレビューとして導入され、差異化ローディングがデフォルトで有効になりました。1ヶ月間使ってみた経験をもとに、アップグレード体験と各機能の実際の効果をまとめます。

## 差異化ローディング：デフォルトで有効

**ビルド成果物の変化**

```
# Angular 7（旧）
dist/
  main.js          # 全ブラウザ向けES5バンドル

# Angular 8（新）
dist/
  main-es2015.js   # モダンブラウザ（Chrome 61+、Firefox 60+）
  main-es5.js      # レガシーブラウザ（IE11 フォールバック）
```

自動生成されるHTML：

```html
<script type="module" src="main-es2015.js"></script>
<script nomodule src="main-es5.js"></script>
```

実測値（中規模Angularプロジェクト）：

- モダンブラウザでメインバンドルが **20%以上削減**
- ランタイムのパース速度が顕著に向上

## Ivy のオプトイン使用

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

Ivy 有効化後の変化：

**ビルド出力**：コンポーネントのファクトリーとレンダリングコードが個別の `ngfactory` ファイルではなく、コンポーネントファイルの隣に直接生成されます。

```typescript
// 以前：user.component.ngfactory.ts が生成されていた
// Ivy 以降：デプロイグラフ（インストラクション）はコンポーネントクラスにインライン化
static ɵcmp = defineComponent({...}); // コンパイラが生成
```

## ngcc 互換コンパイラ

Ivy は全ての依存関係も Ivy フォーマットである必要があります。まだ Ivy でコンパイルされていないサードパーティライブラリに対して、Angular は `ngcc`（Angular Compatibility Compiler）を提供し、インストール時に自動変換します：

```bash
# 依存関係インストール後に自動実行
# 手動実行も可能
node_modules/.bin/ngcc
```

## Web Worker CLI サポート

```bash
ng generate web-worker heavy-task
# src/app/heavy-task.worker.ts を生成
```

```typescript
// heavy-task.worker.ts
onmessage = ({ data }) => {
  // ここの計算はメインスレッドをブロックしない
  const result = data.reduce((sum: number, n: number) => sum + n * n, 0);
  postMessage(result);
};

// component.ts での使用
export class AppComponent {
  compute(data: number[]) {
    const worker = new Worker("./heavy-task.worker", { type: "module" });
    worker.onmessage = ({ data: result }) => {
      this.result = result;
    };
    worker.postMessage(data);
  }
}
```

## アップグレードの推奨事項

```bash
# アップグレードコマンド
ng update @angular/cli @angular/core

# CLIが文字列 loadChildren を import() 構文に自動変換
# ViewChild('...') を使用している場合は { static: true/false } の追加を促される
```

## まとめ

Angular 8 の差異化ローディングは既存プロジェクトに最も大きな影響を与えるランタイム改善です。Ivy はまだプレビュー段階ですが、Angular 9 で Ivy がデフォルトになる前に、プロジェクト内の `ViewChild` 静的クエリと遅延ロードのパターンを整理しておくとよいでしょう。
