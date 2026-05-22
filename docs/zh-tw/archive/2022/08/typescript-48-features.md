---
title: "TypeScript 4.7-4.8：ESM 支援與型別收窄的進化"
date: 2022-08-09 10:39:03
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.7 和 4.8 相繼釋出，帶來了一系列實用改進。4.7 解決了 ESM 模組支援的老大難問題，4.8 進一步增強了型別收窄。"
wordCount: 239
---

TypeScript 4.7 和 4.8 相繼釋出，帶來了一系列實用改進。4.7 解決了 ESM 模組支援的老大難問題，4.8 進一步增強了型別收窄。

## TypeScript 4.7：ESM 支援

### package.json 中的 module 設定

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

TypeScript 4.7 終於正確理解 `type: "module"` 和 `exports` 欄位了。

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

`module: "NodeNext"` 讓 TypeScript 按照 Node.js 的 ESM 解析規則來處理模組。

### ESM 中的匯入規則

```typescript
// ESM 必須帶副檔名
import { sum } from './math.js';  // 不是 './math.ts'！

// 目錄匯入需要顯式 index
import { config } from './config/index.js';  // 不是 './config'
```

### extends 支援陣列

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

不再需要一層套一層，直接組合多個基礎設定。

## TypeScript 4.8：型別收窄增強

### 交叉型別與可辨識聯合

```typescript
type Circle = { kind: 'circle'; radius: number };
type Square = { kind: 'square'; sideLength: number };
type Shape = Circle | Square;

// 以前：交叉型別對聯合型別效果不好
// 4.8：正確收窄
function getArea(shape: Shape & { label: string }) {
  // shape 現在被正確識別為 (Circle | Square) & { label: string }
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

### in 運算子的收窄

```typescript
type Admin = { role: 'admin'; permissions: string[] };
type User = { role: 'user'; email: string };
type Person = Admin | User;

function greet(person: Person) {
  if ('permissions' in person) {
    // 4.8 能正確收窄為 Admin
    console.log(person.permissions);
  } else {
    // 收窄為 User
    console.log(person.email);
  }
}
```

### satisfies 的預覽（4.9 正式）

```typescript
// TypeScript 4.9 的 satisfies 在 4.8 開始預覽
type Color = 'red' | 'green' | 'blue';
type Theme = Record<Color, string | number[]>;

// 以前的問題：
const theme1: Theme = {
  red: '#ff0000',
  green: [0, 255, 0],
  blue: '#0000ff',
};
// theme1.red 的型別是 string | number[]（太寬了）

// 用 satisfies：
const theme2 = {
  red: '#ff0000',
  green: [0, 255, 0],
  blue: '#0000ff',
} satisfies Theme;
// theme2.red 的型別是 string ✅
// theme2.green 的型別是 number[] ✅
// 同時保證整體符合 Theme 結構
```

### 控製流收窄的改進

```typescript
function process(value: string | number | boolean) {
  if (typeof value === 'string') {
    // value: string
    if (value.startsWith('prefix-')) {
      // value 仍然保持 string
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

## 實際專案中的收益

### 構建 ESM 包

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
export { sum } from './math.js';  // 必須 .js
export { formatDate } from './date.js';
```

### API 響應型別守衛

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
    // user.role 型別是 'admin'
    console.log('管理員:', user.name);
  } else {
    // user.role 型別是 'user'
    console.log('普通使用者:', user.name);
  }
}
```

## 小結

TypeScript 4.7 的 ESM 支援讓雙包（CJS + ESM）釋出變得可行。4.8 的型別收窄改進減少了型別斷言的使用。建議在新專案中使用 `module: "NodeNext"`，為 ESM 遷移做準備。