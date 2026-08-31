---
title: "TypeScript 4.7-4.8: ESM Support and Type Narrowing Evolution"
date: 2022-08-09 10:39:03
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.7 and 4.8 were released one after another, bringing a series of practical improvements. 4.7 finally solved the long-standing ESM module support issue, and 4.8 further enhanced type narrowing."
wordCount: 153
---

TypeScript 4.7 and 4.8 were released one after another, bringing a series of practical improvements. 4.7 finally solved the long-standing ESM module support issue, and 4.8 further enhanced type narrowing.

## TypeScript 4.7: ESM Support

### Module Configuration in package.json

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

TypeScript 4.7 finally properly understands the `type: "module"` and `exports` fields.

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

`module: "NodeNext"` makes TypeScript follow Node.js ESM resolution rules for modules.

### Import Rules in ESM

```typescript
// ESM 必须带扩展名
import { sum } from './math.js';  // 不是 './math.ts'！

// 目录导入需要显式 index
import { config } from './config/index.js';  // 不是 './config'
```

### extends Supports Arrays

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

No more nesting one layer inside another — just combine multiple base configs directly.

## TypeScript 4.8: Enhanced Type Narrowing

### Intersection Types and Discriminated Unions

```typescript
type Circle = { kind: 'circle'; radius: number };
type Square = { kind: 'square'; sideLength: number };
type Shape = Circle | Square;

// 以前：交叉类型对联合类型效果不好
// 4.8：正确收窄
function getArea(shape: Shape & { label: string }) {
  // shape 现在被正确识别为 (Circle | Square) & { label: string }
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

### Narrowing with the in Operator

```typescript
type Admin = { role: 'admin'; permissions: string[] };
type User = { role: 'user'; email: string };
type Person = Admin | User;

function greet(person: Person) {
  if ('permissions' in person) {
    // 4.8 能正确收窄为 Admin
    console.log(person.permissions);
  } else {
    // 收窄为 User
    console.log(person.email);
  }
}
```

### Preview of satisfies (Official in 4.9)

```typescript
// TypeScript 4.9 的 satisfies 在 4.8 开始预览
type Color = 'red' | 'green' | 'blue';
type Theme = Record<Color, string | number[]>;

// 以前的问题：
const theme1: Theme = {
  red: '#ff0000',
  green: [0, 255, 0],
  blue: '#0000ff',
};
// theme1.red 的类型是 string | number[]（太宽了）

// 用 satisfies：
const theme2 = {
  red: '#ff0000',
  green: [0, 255, 0],
  blue: '#0000ff',
} satisfies Theme;
// theme2.red 的类型是 string ✅
// theme2.green 的类型是 number[] ✅
// 同时保证整体符合 Theme 结构
```

### Control Flow Narrowing Improvements

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

## Benefits in Real Projects

### Building ESM Packages

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
export { sum } from './math.js';  // 必须 .js
export { formatDate } from './date.js';
```

### API Response Type Guards

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
    // user.role 类型是 'admin'
    console.log('管理员:', user.name);
  } else {
    // user.role 类型是 'user'
    console.log('普通用户:', user.name);
  }
}
```

## Summary

TypeScript 4.7's ESM support makes dual-package (CJS + ESM) publishing viable. 4.8's type narrowing improvements reduce the need for type assertions. It's recommended to use `module: "NodeNext"` in new projects to prepare for ESM migration.