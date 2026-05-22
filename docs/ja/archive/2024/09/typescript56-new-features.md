---
title: "TypeScript 5.6：Iterator Helper、正規表現型と厳格な組み込みチェック"
date: 2024-09-22 11:56:33
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.6 が正式にリリースされ、実用的な言語機能と型チェックの強化がもたらされました。日常の開発に最も影響のある変更をいくつか紹介します。"
wordCount: 513
---

TypeScript 5.6 が正式にリリースされ、実用的な言語機能と型チェックの強化がもたらされました。日常の開発に最も影響のある変更をいくつか紹介します。

## Iterator Helpers

イテレータのネイティブサポートにより、`for...of` やジェネレータで直接チェーン操作が可能です：

```typescript
// 以前：配列に変換してから処理する必要があった
const users = Array.from(getAllUsers());
const activeEmails = users
  .filter((u) => u.isActive)
  .map((u) => u.email);

// TypeScript 5.6 + ES2024 Iterator Helpers
const activeEmails = getAllUsers()
  .filter((u) => u.isActive)
  .map((u) => u.email);
// Iterator を返し、中間配列を作成しない
```

サポートされているメソッド：`map`、`filter`、`take`、`drop`、`flatMap`、`reduce`、`toArray`、`forEach`、`some`、`every`、`find`。

```typescript
// 実用的なシナリオ：大ファイルを行ごとに処理
function* readLines(content: string) {
  for (const line of content.split("\n")) {
    yield line;
  }
}

const errors = readLines(hugeLog)
  .filter((line) => line.includes("ERROR"))
  .take(10)    // 最初の10件のみ取得
  .toArray();  // 配列に変換

// async イテレータと組み合わせる
async function* fetchPages() {
  let page = 0;
  while (true) {
    const data = await fetch(`/api/items?page=${page++}`).then((r) => r.json());
    if (data.items.length === 0) return;
    yield* data.items;
  }
}

const first100 = fetchPages()
  .take(100)
  .toArray();
```

## 正規表現型チェック

`RegExp` 型はジェネリクスによるキャプチャグループの注釈をサポートするようになりました：

```typescript
// 以前：exec の結果は RegExpExecArray | null で、キャプチャグループの型が失われる
const match = /user-(\d+)/.exec("user-42");
// match[1] は string で、自動型推論がない

// TypeScript 5.6：可以标注捕获组
function parseRoute(path: string) {
  const match = /^\/users\/(?<id>\d+)\/posts\/(?<postId>\d+)$/.exec(path);
  if (!match?.groups) return null;

  return {
    userId: match.groups.id,      // string
    postId: match.groups.postId,  // string
  };
}
```

## 空プロパティ宣言の禁止

以前は意味のない空の型プロパティを書きがちでしたが、現在はエラーになります：

```typescript
// TypeScript 5.6 以前はエラーにならない
interface Config {
  name: string;
  value: number;
  ; // 空の文、意味なし
}

// TypeScript 5.6：编译报错
// Error: Empty property declaration
```

## 相対パス補完の強化

monorepo において、IDE のパス補完がよりスマートになりました：

```typescript
// packages/ui/src/Button.tsx での参照
// TS 5.6 は正しく相対パスを提案する
import { formatPrice } from "../../utils/src/price";
```

## 制御フロー解析の改善

```typescript
function process(data: string | null) {
  // TS 5.6 は関数呼び出しの型ガードをより適切に理解する
  if (data !== null) {
    const trimmed = data.trim();
    // trimmed は自動的に string として認識
    console.log(trimmed.toUpperCase());
  }
}
```

## 設定項目の更新

```json
// tsconfig.json 新增选项
{
  "compilerOptions": {
    "target": "ES2024",        // 支持 Iterator Helpers
    "lib": ["ES2024", "DOM"],
    "noUncheckedSideEffectImports": true,  // 副作用インポートをチェック
    "isolatedDeclarations": true          // ビルドを高速化
  }
}
```

`isolatedDeclarations` は monorepo のビルド速度を大幅に向上させ、各ファイルの宣言生成を個別に処理できるようにします。

## アップグレードの注意点

1. プロジェクトが Babel で TS をコンパイルしている場合、Babel プラグインが新しい構文をサポートしていることを確認
2. `target: "ES2024"` には対応する runtime のサポート、または polyfill の使用が必要
3. Iterator Helpers の polyfill は `core-js` または `@ungap/iterator-helpers` を使用可能

## まとめ

- Iterator Helpers：遅延評価の反復チェーン、中間配列の割り当てを削減
- 正規表現型の強化：より優れたキャプチャグループの型推論
- `isolatedDeclarations`：monorepo のビルド高速化
- `noUncheckedSideEffectImports`：より厳格な副作用インポートチェック
- `target: "ES2024"` と組み合わせて使用することを推奨
