---
title: "TypeScript 泛型編程模式詳解"
date: 2019-05-29 10:19:35
tags:
  - TypeScript
readingTime: 7
description: "泛型是 TypeScript 類型系統中最強大的特性之一。很多人只知道 `Array<T>` 這種基本用法，實際上泛型結合條件類型、映射類型、`infer` 關鍵字可以實現非常靈活的類型推導。本文從基礎到實戰，系統講解泛型編程模式。"
wordCount: 584
---

泛型是 TypeScript 類型系統中最強大的特性之一。很多人只知道 `Array<T>` 這種基本用法，實際上泛型結合條件類型、映射類型、`infer` 關鍵字可以實現非常靈活的類型推導。本文從基礎到實戰，系統講解泛型編程模式。

## 泛型基礎

泛型的核心思想是：**類型也是參數**。就像函數接收值參數一樣，泛型函數/接口接收類型參數。

```typescript
// 沒有泛型的問題：要麼丟失類型，要麼得寫多次
function identityNumber(arg: number): number {
  return arg;
}
function identityString(arg: string): string {
  return arg;
}
// 每種類型都要寫一個，顯然不合理

// 用泛型解決
function identity<T>(arg: T): T {
  return arg;
}

// 使用時，TypeScript 自動推斷 T
const a = identity('hello'); // T 推斷為 string，返回 string
const b = identity(42);      // T 推斷為 number，返回 number

// 也可以手動指定類型
const c = identity<string>('hello');
```

### 泛型在接口和類中的使用

```typescript
// 泛型接口
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 使用時 T 被具體類型替換
interface User {
  id: number;
  name: string;
}

type UserResponse = ApiResponse<User>;
// 等價於：
// { code: number; message: string; data: User }

// 泛型類
class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }
}

// 每個 Queue 實例只存一種類型
const numberQueue = new Queue<number>();
numberQueue.enqueue(1);
numberQueue.enqueue(2);
// numberQueue.enqueue('three'); // 編譯報錯

const stringQueue = new Queue<string>();
stringQueue.enqueue('hello');
```

## 泛型約束

泛型默認可以接受任何類型，但有時候需要限制 T 必須具備某些屬性。

```typescript
// 問題：這個函數想訪問 arg.length，但不是所有類型都有 length
function logLength<T>(arg: T): number {
  return arg.length; // 報錯：類型 T 上不存在屬性 length
}

// 用 extends 約束 T 必須有 length 屬性
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): number {
  return arg.length; // OK
}

logLength('hello');       // OK，string 有 length
logLength([1, 2, 3]);     // OK，數組有 length
logLength({ length: 10 }); // OK，對象有 length 屬性
// logLength(123);        // 報錯，number 沒有 length
```

### keyof 約束

```typescript
// 只能訪問對象上實際存在的 key
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = {
  id: 1,
  name: '張三',
  age: 25,
};

getProperty(user, 'name'); // 返回類型是 string
getProperty(user, 'age');  // 返回類型是 number
// getProperty(user, 'email'); // 報錯：'email' 不在 'id' | 'name' | 'age' 中
```

### 多泛型參數

```typescript
// 合併兩個對象
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}

const result = merge({ name: '張三' }, { age: 25 });
// result 的類型是 { name: string } & { age: number }
result.name; // OK
result.age;  // OK

// 泛型之間可以互相引用
function mapArray<T, U>(arr: T[], fn: (item: T, index: number) => U): U[] {
  return arr.map(fn);
}

const lengths = mapArray(['hello', 'world', 'ts'], (s) => s.length);
// lengths: number[]
// T 推斷為 string，U 推斷為 number
```

## 條件類型（Conditional Types）

條件類型是 TypeScript 2.8 引入的特性，讓類型可以根據條件選擇。語法類似三元表達式。

```typescript
// 基本語法：T extends U ? X : Y
// 如果 T 能賦值給 U，類型為 X，否則為 Y

type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
```

### 分佈式條件類型

當條件類型的 T 是聯合類型時，會自動分發到每個成員上。

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// 結果：string[] | number[]（不是 (string | number)[]）
// 因為條件類型對聯合類型分發了：
// ToArray<string> | ToArray<number>
// = string[] | number[]

// 不想要分發？用方括號包住
type ToArrayNoDistribute<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNoDistribute<string | number>;
// 結果：(string | number)[]
```

### Exclude 和 Extract 的實現

```typescript
// Exclude：從 T 中排除能賦值給 U 的類型
type MyExclude<T, U> = T extends U ? never : T;

type Ex = MyExclude<'a' | 'b' | 'c', 'a'>;
// 'a' extends 'a' → never
// 'b' extends 'a' → 'b'
// 'c' extends 'a' → 'c'
// 結果：'b' | 'c'

// Extract：從 T 中提取能賦值給 U 的類型
type MyExtract<T, U> = T extends U ? T : never;

type Ex2 = MyExtract<'a' | 'b' | 'c', 'a' | 'b'>;
// 'a' extends 'a' | 'b' → 'a'
// 'b' extends 'a' | 'b' → 'b'
// 'c' extends 'a' | 'b' → never
// 結果：'a' | 'b'
```

## infer 關鍵字

`infer` 是條件類型中的"模式匹配"工具，可以從類型中提取一部分。

```typescript
// 提取函數返回值類型
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function getUser() {
  return { id: 1, name: '張三', age: 25 };
}

type User = MyReturnType<typeof getUser>;
// User = { id: number; name: string; age: number }

// 提取函數參數類型
type MyParameters<T> = T extends (...args: infer P) => any ? P : never;

function createUser(name: string, age: number, isAdmin: boolean) {
  return { name, age, isAdmin };
}

type Params = MyParameters<typeof createUser>;
// Params = [string, number, boolean]
```

### infer 在數組和 Promise 中的應用

```typescript
// 提取數組元素類型
type ElementOf<T> = T extends (infer E)[] ? E : never;

type Str = ElementOf<string[]>;    // string
type Num = ElementOf<number[]>;    // number
type Union = ElementOf<[1, 'a', true]>; // 1 | 'a' | true

// 提取 Promise 的 resolve 類型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type P1 = UnwrapPromise<Promise<string>>; // string
type P2 = UnwrapPromise<Promise<number[]>>; // number[]
type P3 = UnwrapPromise<boolean>; // boolean（不是 Promise，原樣返回）

// 嵌套提取：遞歸解包 Promise
type DeepUnwrapPromise<T> = T extends Promise<infer U>
  ? DeepUnwrapPromise<U>
  : T;

type P4 = DeepUnwrapPromise<Promise<Promise<Promise<string>>>>;
// P4 = string
```

### 用 infer 實現字符串類型操作

```typescript
// 提取字符串第一個字符
type Head<T extends string> = T extends `${infer First}${string}`
  ? First
  : never;

type H1 = Head<'hello'>; // 'h'
type H2 = Head<'world'>; // 'w'

// 提取字符串剩餘部分
type Tail<T extends string> = T extends `${string}${infer Rest}`
  ? Rest
  : never;

type T1 = Tail<'hello'>; // 'ello'
type T2 = Tail<'h'>;     // ''

// 字符串轉聯合類型
type Split<S extends string, Sep extends string> =
  S extends `${infer First}${Sep}${infer Rest}`
    ? First | Split<Rest, Sep>
    : S;

type Tags = Split<'html,css,javascript', ','>;
// 'html' | 'css' | 'javascript'
```

## 映射類型（Mapped Types）

映射類型基於舊類型創建新類型，遍歷聯合類型的每個成員。

```typescript
// 基本語法
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Partial<T> = {
  [P in keyof T]?: T[P];
};

// 使用
interface User {
  id: number;
  name: string;
  age: number;
}

type ReadonlyUser = Readonly<User>;
// { readonly id: number; readonly name: string; readonly age: number }

type PartialUser = Partial<User>;
// { id?: number; name?: string; age?: number }
```

### 實現 Pick 和 Omit

```typescript
// Pick：從 T 中選取指定的 key
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

type UserName = MyPick<User, 'name'>;
// { name: string }

type UserNameAge = MyPick<User, 'name' | 'age'>;
// { name: string; age: number }

// Omit：從 T 中排除指定的 key
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type UserWithoutAge = MyOmit<User, 'age'>;
// { id: number; name: string }

// 分解來看：
// keyof T = 'id' | 'name' | 'age'
// Exclude<'id' | 'name' | 'age', 'age'> = 'id' | 'name'
// Pick<User, 'id' | 'name'> = { id: number; name: string }
```

### 實現 Record 和 Readonly

```typescript
// Record：構造一個 key 為 K、value 為 T 的對象類型
type MyRecord<K extends keyof any, T> = {
  [P in K]: T;
};

// keyof any 等價於 string | number | symbol

type PageInfo = {
  title: string;
  url: string;
};

type Pages = MyRecord<'home' | 'about' | 'contact', PageInfo>;
// {
//   home: PageInfo;
//   about: PageInfo;
//   contact: PageInfo;
// }

// 實際使用
const pages: Pages = {
  home: { title: '首頁', url: '/' },
  about: { title: '關於', url: '/about' },
  contact: { title: '聯繫', url: '/contact' },
};

// Readonly 的深層版本
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

type Config = {
  api: {
    baseUrl: string;
    timeout: number;
  };
  features: {
    darkMode: boolean;
  };
};

type FrozenConfig = DeepReadonly<Config>;
// {
//   readonly api: {
//     readonly baseUrl: string;
//     readonly timeout: number;
//   };
//   readonly features: {
//     readonly darkMode: boolean;
//   };
// }
```

## 實戰：類型安全的 API 請求封裝

```typescript
// API 路由定義
interface ApiRoutes {
  '/users': {
    GET: {
      params: { page?: number; size?: number };
      response: { list: Array<{ id: number; name: string }>; total: number };
    };
    POST: {
      body: { name: string; email: string };
      response: { id: number; name: string; email: string };
    };
  };
  '/users/:id': {
    GET: {
      params: { id: string };
      response: { id: number; name: string; email: string };
    };
    PUT: {
      params: { id: string };
      body: { name?: string; email?: string };
      response: { id: number; name: string; email: string };
    };
    DELETE: {
      params: { id: string };
      response: { success: boolean };
    };
  };
}

// 提取某路由支持的 HTTP 方法
type MethodOf<R extends keyof ApiRoutes> = keyof ApiRoutes[R];

// 提取某路由某方法的配置
type ConfigOf<
  R extends keyof ApiRoutes,
  M extends MethodOf<R>
> = ApiRoutes[R][M];

// 泛型請求函數
async function request<
  R extends keyof ApiRoutes,
  M extends MethodOf<R>
>(
  route: R,
  method: M,
  options?: {
    params?: ConfigOf<R, M> extends { params: infer P } ? P : never;
    body?: ConfigOf<R, M> extends { body: infer B } ? B : never;
  }
): Promise<ConfigOf<R, M> extends { response: infer Res } ? Res : never> {
  // 實際實現：替換 :id 這樣的路由參數
  let url = route as string;
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }

  const response = await fetch(url, {
    method: method as string,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
}

// 使用時自動類型推導
async function demo() {
  // GET /users
  const users = await request('/users', 'GET', {
    params: { page: 1, size: 10 },
  });
  // users 的類型：{ list: Array<{ id: number; name: string }>; total: number }
  console.log(users.list[0].name); // 完整類型提示

  // POST /users
  const newUser = await request('/users', 'POST', {
    body: { name: '李四', email: 'lisi@example.com' },
  });
  // newUser 的類型：{ id: number; name: string; email: string }

  // GET /users/:id
  const user = await request('/users/:id', 'GET', {
    params: { id: '123' },
  });

  // 以下調用在編譯期就會報錯：
  // request('/users', 'DELETE');       // 報錯：DELETE 需要 params
  // request('/users/:id', 'POST');     // 報錯：/users/:id 沒有 POST 方法
  // request('/users', 'POST', {
  //   body: { name: 123 }              // 報錯：name 應為 string
  // });
}
```

## 實戰：類型安全的表單驗證

```typescript
// 表單字段規則
interface FieldRule<T> {
  required?: boolean;
  validate?: (value: T) => string | undefined;
  minLength?: T extends string ? number : never;
  maxLength?: T extends string ? number : never;
  min?: T extends number ? number : never;
  max?: T extends number ? number : never;
  pattern?: T extends string ? RegExp : never;
}

// 表單 Schema：每個字段的類型和規則
type FormSchema = {
  [key: string]: {
    type: string | number | boolean;
    rules: FieldRule<any>;
  };
};

// 從 Schema 提取表單值類型
type FormValues<T extends FormSchema> = {
  [K in keyof T]: T[K]['type'];
};

// 從 Schema 提取表單錯誤類型
type FormErrors<T extends FormSchema> = {
  [K in keyof T]?: string;
};

// 表單驗證器
class FormValidator<TSchema extends FormSchema> {
  private schema: TSchema;

  constructor(schema: TSchema) {
    this.schema = schema;
  }

  validate(values: FormValues<TSchema>): FormErrors<TSchema> {
    const errors: FormErrors<TSchema> = {};

    for (const key of Object.keys(this.schema) as Array<keyof TSchema>) {
      const fieldSchema = this.schema[key];
      const value = values[key];
      const rules = fieldSchema.rules;

      // required 檢查
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors[key] = `${String(key)} 是必填項`;
        continue;
      }

      // 字符串特定規則
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors[key] = `${String(key)} 最少 ${rules.minLength} 個字符`;
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors[key] = `${String(key)} 最多 ${rules.maxLength} 個字符`;
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors[key] = `${String(key)} 格式不正確`;
        }
      }

      // 數字特定規則
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors[key] = `${String(key)} 不能小於 ${rules.min}`;
        }
        if (rules.max !== undefined && value > rules.max) {
          errors[key] = `${String(key)} 不能大於 ${rules.max}`;
        }
      }

      // 自定義驗證
      if (rules.validate) {
        const error = rules.validate(value);
        if (error) {
          errors[key] = error;
        }
      }
    }

    return errors;
  }
}

// 定義註冊表單的 Schema
const registerSchema = {
  username: {
    type: '' as string,
    rules: {
      required: true,
      minLength: 3,
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_]+$/,
    },
  },
  email: {
    type: '' as string,
    rules: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      validate: (v: string) =>
        v.endsWith('.con') ? '請檢查郵箱域名是否正確' : undefined,
    },
  },
  age: {
    type: 0 as number,
    rules: {
      required: true,
      min: 18,
      max: 120,
    },
  },
  agreeTerms: {
    type: false as boolean,
    rules: {
      required: true,
      validate: (v: boolean) => (!v ? '請同意用户協議' : undefined),
    },
  },
};

const validator = new FormValidator(registerSchema);

// 使用時有完整類型提示
const values: FormValues<typeof registerSchema> = {
  username: 'zhangsan',
  email: 'zhangsan@example.com',
  age: 25,
  agreeTerms: true,
};

const errors = validator.validate(values);
// errors 的類型：FormErrors<typeof registerSchema>
// = { username?: string; email?: string; age?: string; agreeTerms?: string }

// 編譯期類型檢查
// values.username = 123;  // 報錯：不能把 number 賦給 string
// values.age = '25';      // 報錯：不能把 string 賦給 number
```

## 常用內置工具類型速查

```typescript
// Partial<T> - 所有屬性變為可選
type PartialUser = Partial<User>;

// Required<T> - 所有屬性變為必填
type RequiredUser = Required<PartialUser>;

// Readonly<T> - 所有屬性變為只讀
type ReadonlyUser = Readonly<User>;

// Pick<T, K> - 選取部分屬性
type UserName = Pick<User, 'name' | 'id'>;

// Omit<T, K> - 排除部分屬性
type UserWithoutAge = Omit<User, 'age'>;

// Record<K, T> - 構造鍵值對類型
type UserMap = Record<string, User>;

// Exclude<T, U> - 從聯合類型中排除
type T1 = Exclude<'a' | 'b' | 'c', 'a'>; // 'b' | 'c'

// Extract<T, U> - 從聯合類型中提取
type T2 = Extract<'a' | 'b' | 'c', 'a' | 'b'>; // 'a' | 'b'

// NonNullable<T> - 排除 null 和 undefined
type T3 = NonNullable<string | null | undefined>; // string

// ReturnType<T> - 獲取函數返回值類型
type T4 = ReturnType<() => string>; // string

// Parameters<T> - 獲取函數參數類型
type T5 = Parameters<(a: string, b: number) => void>; // [string, number]

// InstanceType<T> - 獲取構造函數實例類型
class MyClass { x = 0; }
type T6 = InstanceType<typeof MyClass>; // MyClass
```

## 小結

- 泛型讓類型可以參數化，是 TypeScript 類型系統的基礎構建塊
- 泛型約束（`extends`）限制類型參數的範圍，`keyof` 約束確保 key 存在於對象上
- 條件類型（`T extends U ? X : Y`）實現類型級別的條件判斷，對聯合類型有自動分發行為
- `infer` 關鍵字實現類型模式匹配，可以從複雜類型中提取子類型
- 映射類型（`[P in keyof T]`）實現類型遍歷和變換，是 `Partial`、`Pick`、`Readonly` 等工具類型的基礎
- 實戰中泛型能實現 API 路由的類型安全封裝和表單驗證，讓編譯期就能發現類型錯誤
- 多用 TypeScript 內置工具類型，理解它們的實現原理能更好地自定義類型
