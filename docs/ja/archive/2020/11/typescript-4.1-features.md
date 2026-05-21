---
title: "TypeScript 4.1 新機能解説"
date: 2020-11-24 17:33:01
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.1 发布了，带来了几个非常实用的类型系统增强。特别是模板字面量类型和递归条件类型，让类型编程能力又上了一个台阶。"
wordCount: 233
---

TypeScript 4.1 发布了，带来了几个非常实用的类型系统增强。特别是模板字面量类型和递归条件类型，让类型编程能力又上了一个台阶。

## テンプレートリテラル型

```typescript
// 类似模板字符串，但在类型层面
type Color = 'red' | 'blue';
type Size = 'sm' | 'lg';

// 生成组合类型
type ColorSize = `${Color}-${Size}`;
// 'red-sm' | 'red-lg' | 'blue-sm' | 'blue-lg'

// 实际场景：事件名推断
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

// 配合 CSS 类名生成
type Breakpoint = 'sm' | 'md' | 'lg';
type CSSProperty = 'padding' | 'margin';
type ResponsiveClass = `${Breakpoint}:${CSSProperty}`;
// 'sm:padding' | 'sm:margin' | 'md:padding' | ...
```

## マップ型でのキーリマッピング

```typescript
// 以前：映射类型只能保留原 key
type Getters<T> = {
  [K in keyof T]: () => T[K];
};

// TypeScript 4.1：可以用 as 重映射 key
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// 实际场景：过滤 key
type ExtractStringKeys<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

interface Config {
  name: string;
  count: number;
  active: boolean;
  label: string;
}

type StringConfig = ExtractStringKeys<Config>;
// { name: string; label: string }
```

## 再帰的条件型

```typescript
// TypeScript 4.1 放宽了条件类型的递归限制

// 深度 Readonly
type DeepReadonly<T> = T extends (infer U)[]
  ? Readonly<DeepReadonly<U>[]>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

interface State {
  user: {
    name: string;
    profile: {
      avatar: string;
      bio: string;
    };
  };
  settings: {
    theme: string;
  };
}

type ReadonlyState = DeepReadonly<State>;
// user.profile.avatar 是 readonly，所有嵌套属性都是 readonly

// 展平嵌套数组
type Flatten<T> = T extends (infer U)[]
  ? U extends (infer V)[]
    ? Flatten<V>
    : U
  : T;

type Result = Flatten<string[][][]>;
// string
```

## 再帰型参照の深度向上

```typescript
// TypeScript 4.0 之前递归深度限制较严格
// 4.1 放宽了限制

// JSON 类型定义
type Json = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [Key in string]?: Json };
type JsonArray = Json[];

// 路径类型提取
type PathKeys<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${PathKeys<T[K]>}` | K
    : K
  : never;

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  server: {
    port: number;
  };
}

type ConfigPaths = PathKeys<Config>;
// "database" | "server" | "database.host" | "database.port"
// | "database.credentials" | "database.credentials.username"
// | "database.credentials.password" | "server.port"
```

## 文字列・数値インデックスアクセス

```typescript
// 用数字索引访问元组类型
type Tuple = [string, number, boolean];

type First = Tuple[0]; // string
type Second = Tuple[1]; // number
type Length = Tuple['length']; // 3

// 用模板字面量提取元组类型
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

type H = Head<[1, 2, 3]>; // 1
type T = Tail<[1, 2, 3]>; // [2, 3]
```

## より良いエラーメッセージ

```typescript
// TypeScript 4.1 的错误信息更清晰

// 深层类型不匹配时，会标出具体哪个属性有问题
interface User {
  name: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
}

const user: User = {
  name: '张三',
  age: 28,
  address: {
    city: '北京',
    zip: 123,  // Error: Type 'number' is not assignable to type 'string'
               // 现在会明确指出是 address.zip 的问题
  },
};
```

## tsconfig の設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```bash
# 升级
npm install typescript@4.1 -D

# 验证版本
npx tsc --version
```

## まとめ

- 模板字面量类型让类型编程可以做字符串操作，非常强大
- Key Remapping 让映射类型可以重命名 key，派生类型更灵活
- 递归条件类型的限制放宽，可以实现深度嵌套的类型转换
- 错误提示更精确，调试类型问题更高效
- TypeScript 正在变得越来越像一门类型编程语言
