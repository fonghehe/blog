---
title: "TypeScript 4.1 新特性解讀"
date: 2020-11-24 17:33:01
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.1 釋出了，帶來了幾個非常實用的型別系統增強。特別是模板字面量型別和遞迴條件型別，讓型別程式設計能力又上了一個臺階。"
wordCount: 209
---

TypeScript 4.1 釋出了，帶來了幾個非常實用的型別系統增強。特別是模板字面量型別和遞迴條件型別，讓型別程式設計能力又上了一個臺階。

## 模板字面量型別

```typescript
// 類似模板字串，但在型別層面
type Color = 'red' | 'blue';
type Size = 'sm' | 'lg';

// 生成組合型別
type ColorSize = `${Color}-${Size}`;
// 'red-sm' | 'red-lg' | 'blue-sm' | 'blue-lg'

// 實際場景：事件名推斷
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

// 配合 CSS 類名生成
type Breakpoint = 'sm' | 'md' | 'lg';
type CSSProperty = 'padding' | 'margin';
type ResponsiveClass = `${Breakpoint}:${CSSProperty}`;
// 'sm:padding' | 'sm:margin' | 'md:padding' | ...
```

## Key Remapping in Mapped Types

```typescript
// 以前：對映型別只能保留原 key
type Getters<T> = {
  [K in keyof T]: () => T[K];
};

// TypeScript 4.1：可以用 as 重對映 key
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// 實際場景：過濾 key
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

## 遞迴條件型別

```typescript
// TypeScript 4.1 放寬了條件型別的遞迴限制

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
// user.profile.avatar 是 readonly，所有巢狀屬性都是 readonly

// 展平巢狀陣列
type Flatten<T> = T extends (infer U)[]
  ? U extends (infer V)[]
    ? Flatten<V>
    : U
  : T;

type Result = Flatten<string[][][]>;
// string
```

## 遞迴型別引用深度提升

```typescript
// TypeScript 4.0 之前遞迴深度限制較嚴格
// 4.1 放寬了限制

// JSON 型別定義
type Json = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [Key in string]?: Json };
type JsonArray = Json[];

// 路徑型別提取
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

## 字串數字索引訪問

```typescript
// 用數字索引訪問元組型別
type Tuple = [string, number, boolean];

type First = Tuple[0]; // string
type Second = Tuple[1]; // number
type Length = Tuple['length']; // 3

// 用模板字面量提取元組型別
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

type H = Head<[1, 2, 3]>; // 1
type T = Tail<[1, 2, 3]>; // [2, 3]
```

## 更好的錯誤提示

```typescript
// TypeScript 4.1 的錯誤資訊更清晰

// 深層型別不匹配時，會標出具體哪個屬性有問題
interface User {
  name: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
}

const user: User = {
  name: '張三',
  age: 28,
  address: {
    city: '北京',
    zip: 123,  // Error: Type 'number' is not assignable to type 'string'
               // 現在會明確指出是 address.zip 的問題
  },
};
```

## tsconfig 配置

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
# 升級
npm install typescript@4.1 -D

# 驗證版本
npx tsc --version
```

## 小結

- 模板字面量型別讓型別程式設計可以做字串操作，非常強大
- Key Remapping 讓對映型別可以重新命名 key，派生型別更靈活
- 遞迴條件型別的限制放寬，可以實現深度巢狀的型別轉換
- 錯誤提示更精確，除錯型別問題更高效
- TypeScript 正在變得越來越像一門型別程式語言
