---
title: "Node.js 14の新機能とオプショナルチェーンサポート"
date: 2020-08-17 10:39:36
tags:
  - JavaScript
readingTime: 3
description: "Node.js 14 LTS は 4 月にリリースされ、多くの便利な機能をもたらしました。フロントエンドエンジニアにとって最も嬉しいのは、V8 エンジンが 8.1 にアップグレードされ、Optional Chaining（?.）と Nullish Coalescing（??）をネイティブサポートしたことです。Node コードでこれらの構文を手動でトランスパイルする必要がなくなりました。"
wordCount: 515
---

Node.js 14 LTS は 4 月にリリースされ、多くの便利な機能をもたらしました。フロントエンドエンジニアにとって最も嬉しいのは、V8 エンジンが 8.1 にアップグレードされ、Optional Chaining（`?.`）と Nullish Coalescing（`??`）をネイティブサポートしたことです。Node コードでこれらの構文を手動でトランスパイルする必要がなくなりました。

## オプショナルチェーン

### 基本的な使い方

```javascript
// 以前の書き方 —— 冗長でエラーが発生しやすい
const userName = user && user.profile && user.profile.name;
const street = res && res.data && res.data.address && res.data.address.street;

// Node.js 14 —— オプショナルチェーン
const userName = user?.profile?.name;
const street = res?.data?.address?.street;

// 途中のいずれかが null または undefined の場合、直接 undefined を返す
// "Cannot read property 'xxx' of undefined" エラーは発生しない
```

### メソッド呼び出しのオプショナルチェーン

```javascript
// 存在しない可能性のあるメソッドを呼び出す
user?.notify?.("hello");

// 以前
if (user && typeof user.notify === "function") {
  user.notify("hello");
}
```

### 配列アクセスのオプショナルチェーン

```javascript
// 安全に配列要素にアクセス
const firstItem = arr?.[0];
const nested = matrix?.[row]?.[col];

// 以前
const firstItem = arr && arr[0];
```

### 実践シナリオ

```javascript
// API レスポンス処理 —— 非常に一般的なシナリオ
function getFormattedPrice(response) {
  const price = response?.body?.data?.product?.price?.amount;
  const currency = response?.body?.data?.product?.price?.currency;

  if (price == null) return "价格暂无";
  return `${currency === "CNY" ? "¥" : "$"}${price.toFixed(2)}`;
}

// 設定の読み取り
const dbHost = config?.database?.connection?.host ?? "localhost";
const dbPort = config?.database?.connection?.port ?? 3306;

// イベント処理
function handleClick(event) {
  const target = event?.target?.dataset?.actionId;
  if (target) {
    dispatchAction(target);
  }
}
```

## Null合体演算子

`??` と `||` の違いは重要です：

```javascript
// || は左辺が falsy の場合に右辺を返す
// 0, '', false, null, undefined を含む
const count = 0;
const result = count || 10; // 10 —— 0 は falsy とみなされる

// ?? は左辺が null または undefined の場合のみ右辺を返す
const count = 0;
const result = count ?? 10; // 0 —— 0 は null/undefined ではないため、元の値が保持される

const flag = false;
const r1 = flag || "default"; // 'default'
const r2 = flag ?? "default"; // false

const text = "";
const r3 = text || "无内容"; // '无内容'
const r4 = text ?? "无内容"; // ''
```

### 実際の応用

```typescript
// ページネーションパラメータ —— page=0 は有効な最初のページ
function getPagination(query: Record<string, string>) {
  const page = Number(query.page ?? "0"); // ?? により page=0 が上書きされない
  const size = Number(query.size ?? "20");
  const sort = query.sort ?? "createdAt";
  return { page, size, sort };
}

// API 設定 —— timeout は 0 の場合がある（無限待機を示す）
const timeout = options.timeout ?? 30000; // 0 はタイムアウトなし、undefined はデフォルト 30 秒

// オプショナルチェーンと組み合わせて使用
const name =
  user?.profile?.displayName ?? user?.profile?.username ?? "匿名用户";
```

## Array.flat() と Array.flatMap()

Node.js 14 の V8 8.1 もこれらのメソッドをネイティブサポートしています：

```javascript
// Array.flat() —— 配列の平坦化
const nested = [1, [2, 3], [4, [5, 6]]];
nested.flat(); // [1, 2, 3, 4, [5, 6]]
nested.flat(2); // [1, 2, 3, 4, 5, 6]
nested.flat(Infinity); // 完全に平坦化

// 実用的なシナリオ：ディレクトリ構造の平坦化
const files = [
  ["src/index.js", "src/app.js"],
  ["src/utils/a.js", "src/utils/b.js"],
  ["test/app.test.js"],
];
const allFiles = files.flat();
// ['src/index.js', 'src/app.js', 'src/utils/a.js', 'src/utils/b.js', 'test/app.test.js']

// Array.flatMap() —— map + flat を組み合わせたもの
const sentences = ["Hello World", "Foo Bar"];
const words = sentences.flatMap((s) => s.split(" "));
// ['Hello', 'World', 'Foo', 'Bar']

// 実用的：空配列を返してフィルタリング
const ids = [1, 2, 3, 4, 5];
const results = ids.flatMap((id) => {
  const item = cache.get(id);
  return item ? [item] : []; // 見つからなければ空配列を返し、フィルタリングと同様の効果
});
```

## globalThis

統一されたグローバルオブジェクトへのアクセス方法：

```javascript
// 以前 —— 環境の判定が必要
let globalObj;
if (typeof window !== "undefined") {
  globalObj = window; // ブラウザ
} else if (typeof global !== "undefined") {
  globalObj = global; // Node.js
} else if (typeof self !== "undefined") {
  globalObj = self; // Web Worker
}

// Node.js 14 —— globalThis
globalObj = globalThis; // どの環境でも適用可能

// 実用的：環境を越えたグローバルキャッシュ
const GLOBAL_KEY = Symbol.for("__myAppCache__");
const cache = globalThis[GLOBAL_KEY] ?? (globalThis[GLOBAL_KEY] = new Map());
```

## String.matchAll()

```javascript
// 以前はすべての一致を抽出するのが面倒だった
const text = '2020-07-20, 2020-08-17, 2020-09-14'
const regex = /(\d{4})-(\d{2})-(\d{2})/g

// exec でループする必要があった
let match
while ((match = regex.exec(text)) !== null) {
  console.log(match[1], match[2], match[3])
}

// Node.js 14 —— matchAll
for (const match of text.matchAll(regex)) {
  console.log(match[1], match[2], match[3])
}

// 配列に変換
const dates = [...text.matchAll(regex)].map(m => ({
  full: m[0],
  year: m[1],
  month: m[2],
  day: m[3]
}))

// 実用的：ログからエラー情報を抽出
function parseLogErrors(log: string) {
  const pattern = /\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\]\s+ERROR:\s+(.+)/g
  return [...log.matchAll(pattern)].map(m => ({
    date: m[1],
    time: m[2],
    message: m[3]
  }))
}
```

## Intl.DisplayNames —— 国际化名称

```javascript
// 言語、地域、通貨のローカライズ表示名を取得
const regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
console.log(regionNames.of("US")); // 美国
console.log(regionNames.of("JP")); // 日本
console.log(regionNames.of("CN")); // 中国

const languageNames = new Intl.DisplayNames(["zh"], { type: "language" });
console.log(languageNames.of("en")); // 英语
console.log(languageNames.of("ja")); // 日语
console.log(languageNames.of("zh")); // 中文

const currencyNames = new Intl.DisplayNames(["zh"], { type: "currency" });
console.log(currencyNames.of("CNY")); // 人民币
console.log(currencyNames.of("USD")); // 美元
```

## tsconfig.json での設定

TypeScript を使用するプロジェクトでは、これらの新機能を利用するために設定が必要です：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "esModuleInterop": true
  }
}
```

## まとめ

- Node.js 14 は Optional Chaining（`?.`）と Nullish Coalescing（`??`）をネイティブサポートし、Babel によるトランスパイルが不要になりました
- `??` と `||` の違い：`??` は null/undefined のみを処理し、`||` はすべての falsy 値を処理します
- `Array.flat()` と `Array.flatMap()` がネイティブで使用可能になり、配列操作が簡素化されました
- `globalThis` は統一されたグローバルオブジェクトへのアクセス方法を提供します
- `String.matchAll()` により正規表現の一括マッチングがエレガントになりました
- `Intl.DisplayNames` は国際化のシナリオに便利です
- tsconfig の target を ES2020 に設定することでこれらの機能を利用できます
