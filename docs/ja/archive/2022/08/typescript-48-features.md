---
title: "TypeScript 4.7-4.8：ESM サポートと型絞り込みの進化"
date: 2022-08-09 10:39:03
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.7 と 4.8 が相次いでリリースされ、一連の実用的な改善がもたらされました。4.7 は ESM モジュールサポートの長年の課題を解決し、4.8 は型の絞り込みをさらに強化しました。"
wordCount: 365
---

TypeScript 4.7 と 4.8 が相次いでリリースされ、一連の実用的な改善がもたらされました。4.7 はESMモジュールサポートの長年の課題を解決し、4.8 はさらに型の絞り込みを強化しました。

## TypeScript 4.7：ESM サポート

### package.json 中的 module 配置

```json
{
  "name": "@mono/utils",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
}
```

TypeScript 4.7 はついに `type: "module"` と `exports` フィールドを正しく理解するようになりました。

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

`module: "NodeNext"` により、TypeScript は Node.js の ESM 解決ルールに従ってモジュールを処理します。

### ESM 中的导入规则

```typescript
// ESM は拡張子が必要
import { sum } from './math.js';  // './math.ts' ではありません！

// ディレクトリのインポートには明示的な index が必要
import { config } from './config/index.js';  // './config' ではありません
```

### extends 支持数组

```json
// tsconfig.json
{
  "extends": [
    "@mono/ts-config/base.json",
    "@mono/ts-config/react.json"
  ],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

もう入れ子にする必要はなく、複数の基本設定を直接組み合わせられます。

## TypeScript 4.8：型絞り込みの強化

### 交叉类型与可辨识联合

```typescript
type Circle = { kind: 'circle'; radius: number };
type Square = { kind: 'square'; sideLength: number };
type Shape = Circle | Square;

// 以前：交差型は共用体型に対して効果が悪かった
// 4.8：正しく絞り込める
function getArea(shape: Shape & { label: string }) {
  // shape は正しく (Circle | Square) & { label: string } として認識される
  switch (shape.kind) {
    case 'circle':
      // shape: Circle & { label: string }
      return Math.PI * shape.radius ** 2;
    case 'square':
      // shape: Square & { label: string }
      return shape.sideLength ** 2;
  }
}
```

### in 操作符的收窄

```typescript
type Admin = { role: 'admin'; permissions: string[] };
type User = { role: 'user'; email: string };
type Person = Admin | User;

function greet(person: Person) {
  if ('permissions' in person) {
    // 4.8 では正しく Admin に絞り込める
    console.log(person.permissions);
  } else {
    // User に絞り込まれる
    console.log(person.email);
  }
}
```

### satisfies 的预览（4.9 正式）

```typescript
// TypeScript 4.9 の satisfies は 4.8 でプレビュー開始
type Color = 'red' | 'green' | 'blue';
type Theme = Record<Color, string | number[]>;

// 以前の問題：
const theme1: Theme = {
  red: '#ff0000',
  green: [0, 255, 0],
  blue: '#0000ff',
};
// theme1.red の型は string | number[]（広すぎる）

// satisfies を使用：
const theme2 = {
  red: '#ff0000',
  green: [0, 255, 0],
  blue: '#0000ff',
} satisfies Theme;
// theme2.red の型は string ✅
// theme2.green の型は number[] ✅
// 同時に全体が Theme 構造に適合することを保証
```

### 控制流收窄的改进

```typescript
function process(value: string | number | boolean) {
  if (typeof value === 'string') {
    // value: string
    if (value.startsWith('prefix-')) {
      // value は引き続き string のまま
      return value.slice(7);
    }
  }

  if (typeof value === 'number') {
    // value: number
    return value * 2;
  }

  // value: boolean
  return !value;
}
```

## 実際のプロジェクトでのメリット

### 构建 ESM 包

```typescript
// packages/utils/package.json
{
  "name": "@mono/utils",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}

// packages/utils/tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist"
  }
}

// packages/utils/src/index.ts
export { sum } from './math.js';  // .js が必要
export { formatDate } from './date.js';
```

### API 响应类型守卫

```typescript
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

interface User {
  id: number;
  name: string;
  role: 'admin' | 'user';
}

function isAdmin(user: User): user is User & { role: 'admin' } {
  return user.role === 'admin';
}

async function fetchAndProcess(id: number) {
  const res: ApiResponse<User> = await fetch(`/api/users/${id}`)
    .then(r => r.json());

  if (res.code !== 200) {
    throw new Error(res.message);
  }

  const user = res.data;

  if (isAdmin(user)) {
    // user.role の型は 'admin'
    console.log('管理员:', user.name);
  } else {
    // user.role の型は 'user'
    console.log('普通用户:', user.name);
  }
}
```

## まとめ

TypeScript 4.7 の ESM サポートにより、デュアルパッケージ（CJS + ESM）公開が実現可能になりました。4.8 の型絞り込みの改善により、型アサーションの使用が減少しました。新しいプロジェクトでは `module: "NodeNext"` を使用し、ESM 移行に備えることをお勧めします。