---
title: "TypeScript 基礎：今こそ学ぶべき理由"
date: 2018-03-03 17:32:01
tags:
  - TypeScript
readingTime: 3
description: "TypeScript は新しい技術ではありません（Microsoft が 2012 年にリリース）が、2017〜2018 年になってようやく国内フロントエンド界で本格的に普及し始めました。Angular 2+ は使用を強制し、Vue 2.5 も TS サポートを改善しました。そろそろ真剣に学ぶ時期です。"
---

TypeScript は新しい技術ではありません（Microsoft が 2012 年にリリース）が、2017〜2018 年になってようやく国内フロントエンド界で本格的に普及し始めました。Angular 2+ は使用を強制し、Vue 2.5 も TS サポートを改善しました。そろそろ真剣に学ぶ時期です。

## なぜ TypeScript を使うのか

JavaScript の型問題は実行時にしか露見しないことが多いです：

```javascript
function add(a, b) {
  return a + b;
}

add(1, 2); // 3、正しい
add("1", 2); // '12'、文字列結合 — おそらくバグ
add(null, 2); // 2、null が 0 として扱われる — 予期せぬ動作
```

TypeScript はコンパイル時にこうした問題を検出します：

```typescript
function add(a: number, b: number): number {
  return a + b;
}

add("1", 2); // ❌ コンパイルエラー：Argument of type 'string' is not assignable to parameter of type 'number'
```

## 基本型

```typescript
// プリミティブ型
let name: string = "Alice";
let age: number = 25;
let isActive: boolean = true;

// 配列
let nums: number[] = [1, 2, 3];
let strs: Array<string> = ["a", "b"];

// タプル（長さと型が固定）
let pair: [string, number] = ["Alice", 25];

// 列挙型
enum Direction {
  Up,
  Down,
  Left,
  Right,
}
let dir: Direction = Direction.Up; // 値は 0

// any（脱出ハッチ — なるべく使わない）
let anything: any = "hello";
anything = 42; // エラーなし

// void（戻り値なしの関数）
function log(msg: string): void {
  console.log(msg);
}

// null と undefined
let n: null = null;
let u: undefined = undefined;
```

## インターフェース

オブジェクトの形状を記述する：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // オプションプロパティ
  readonly token: string; // 読み取り専用プロパティ
}

function createUser(user: User): void {
  console.log(user.name);
  // user.token = 'new'  // ❌ 読み取り専用、変更不可
}

createUser({
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  token: "abc123",
});
```

インターフェースで関数を記述することもできます：

```typescript
interface SearchFunc {
  (query: string, limit: number): Promise<string[]>;
}

const search: SearchFunc = async (query, limit) => {
  // 実装...
  return [];
};
```

## 型エイリアス

```typescript
type ID = string | number;
type Status = "active" | "inactive" | "pending";

let userId: ID = 123;
userId = "user-456"; // これも有効

let status: Status = "active";
status = "deleted"; // ❌ ユニオン型に含まれていない
```

## ジェネリクス

関数・クラス・インターフェースを複数の型に対応させる：

```typescript
// ジェネリクスなし：any を使うしかなく、型安全性が失われる
function first(arr: any[]): any {
  return arr[0];
}

// ジェネリクスあり：型安全
function first<T>(arr: T[]): T {
  return arr[0];
}

const num = first([1, 2, 3]); // 型推論：num は number
const str = first(["a", "b"]); // str は string
```

## Vue 2.5+ で TypeScript を使う

### 方法 1：vue-class-component（デコレータスタイル）

```typescript
{% raw %}
import Vue from "vue";
import Component from "vue-class-component";

@Component({
  template: '<button @click="onClick">{{ count }}</button>',
})
class Counter extends Vue {
  count: number = 0;

  onClick() {
    this.count++;
  }
}
{% endraw %}
```

### 方法 2：Vue.extend（標準 Options API に近い）

```typescript
import Vue from "vue";

export default Vue.extend({
  data() {
    return {
      count: 0 as number,
      user: null as User | null,
    };
  },
  methods: {
    increment(): void {
      this.count++;
    },
    async fetchUser(id: number): Promise<void> {
      this.user = await api.getUser(id);
    },
  },
});
```

## tsconfig.json 基本設定

```json
{
  "compilerOptions": {
    "target": "es5", // ES5 にコンパイル
    "module": "commonjs",
    "strict": true, // 全厳格チェックを有効化（推奨）
    "esModuleInterop": true, // import xxx from 'xxx' スタイルを許可
    "sourceMap": true, // ソースマップを生成
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"] // パスエイリアス
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## 段階的な移行戦略

全ての JS を一度に TS へ変換する必要はありません。段階的に移行できます：

1. `tsconfig.json` の `allowJs: true` を有効にして、JS と TS ファイルを混在させる
2. 新しいファイルは `.ts` で書く
3. 重要な古いファイルを順次 `.ts` に変換する
4. 最後に `allowJs: false` にする

## まとめ

TypeScript の核心的な価値は**コードを書く段階で型エラーを発見できること**であり、実行時ではありません。中大規模プロジェクトでは、そのメリットは非常に明確です。学習コストは低く、インターフェースと基本型から始めて、必要に応じてドキュメントを参照すれば十分です。
