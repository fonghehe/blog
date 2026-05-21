---
title: "TypeScript 泛型编程模式详解"
date: 2019-05-29 10:19:35
tags:
  - TypeScript
readingTime: 7
description: "泛型是 TypeScript 类型系统中最强大的特性之一。很多人只知道 `Array<T>` 这种基本用法，实际上泛型结合条件类型、映射类型、`infer` 关键字可以实现非常灵活的类型推导。本文从基础到实战，系统讲解泛型编程模式。"
wordCount: 584
---

泛型是 TypeScript 类型系统中最强大的特性之一。很多人只知道 `Array<T>` 这种基本用法，实际上泛型结合条件类型、映射类型、`infer` 关键字可以实现非常灵活的类型推导。本文从基础到实战，系统讲解泛型编程模式。

## 泛型基础

泛型的核心思想是：**类型也是参数**。就像函数接收值参数一样，泛型函数/接口接收类型参数。

```typescript
// 没有泛型的问题：要么丢失类型，要么得写多次
function identityNumber(arg: number): number {
  return arg;
}
function identityString(arg: string): string {
  return arg;
}
// 每种类型都要写一个，显然不合理

// 用泛型解决
function identity<T>(arg: T): T {
  return arg;
}

// 使用时，TypeScript 自动推断 T
const a = identity('hello'); // T 推断为 string，返回 string
const b = identity(42);      // T 推断为 number，返回 number

// 也可以手动指定类型
const c = identity<string>('hello');
```

### 泛型在接口和类中的使用

```typescript
// 泛型接口
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 使用时 T 被具体类型替换
interface User {
  id: number;
  name: string;
}

type UserResponse = ApiResponse<User>;
// 等价于：
// { code: number; message: string; data: User }

// 泛型类
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

// 每个 Queue 实例只存一种类型
const numberQueue = new Queue<number>();
numberQueue.enqueue(1);
numberQueue.enqueue(2);
// numberQueue.enqueue('three'); // 编译报错

const stringQueue = new Queue<string>();
stringQueue.enqueue('hello');
```

## 泛型约束

泛型默认可以接受任何类型，但有时候需要限制 T 必须具备某些属性。

```typescript
// 问题：这个函数想访问 arg.length，但不是所有类型都有 length
function logLength<T>(arg: T): number {
  return arg.length; // 报错：类型 T 上不存在属性 length
}

// 用 extends 约束 T 必须有 length 属性
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): number {
  return arg.length; // OK
}

logLength('hello');       // OK，string 有 length
logLength([1, 2, 3]);     // OK，数组有 length
logLength({ length: 10 }); // OK，对象有 length 属性
// logLength(123);        // 报错，number 没有 length
```

### keyof 约束

```typescript
// 只能访问对象上实际存在的 key
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = {
  id: 1,
  name: '张三',
  age: 25,
};

getProperty(user, 'name'); // 返回类型是 string
getProperty(user, 'age');  // 返回类型是 number
// getProperty(user, 'email'); // 报错：'email' 不在 'id' | 'name' | 'age' 中
```

### 多泛型参数

```typescript
// 合并两个对象
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}

const result = merge({ name: '张三' }, { age: 25 });
// result 的类型是 { name: string } & { age: number }
result.name; // OK
result.age;  // OK

// 泛型之间可以互相引用
function mapArray<T, U>(arr: T[], fn: (item: T, index: number) => U): U[] {
  return arr.map(fn);
}

const lengths = mapArray(['hello', 'world', 'ts'], (s) => s.length);
// lengths: number[]
// T 推断为 string，U 推断为 number
```

## 条件类型（Conditional Types）

条件类型是 TypeScript 2.8 引入的特性，让类型可以根据条件选择。语法类似三元表达式。

```typescript
// 基本语法：T extends U ? X : Y
// 如果 T 能赋值给 U，类型为 X，否则为 Y

type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
```

### 分布式条件类型

当条件类型的 T 是联合类型时，会自动分发到每个成员上。

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// 结果：string[] | number[]（不是 (string | number)[]）
// 因为条件类型对联合类型分发了：
// ToArray<string> | ToArray<number>
// = string[] | number[]

// 不想要分发？用方括号包住
type ToArrayNoDistribute<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNoDistribute<string | number>;
// 结果：(string | number)[]
```

### Exclude 和 Extract 的实现

```typescript
// Exclude：从 T 中排除能赋值给 U 的类型
type MyExclude<T, U> = T extends U ? never : T;

type Ex = MyExclude<'a' | 'b' | 'c', 'a'>;
// 'a' extends 'a' → never
// 'b' extends 'a' → 'b'
// 'c' extends 'a' → 'c'
// 结果：'b' | 'c'

// Extract：从 T 中提取能赋值给 U 的类型
type MyExtract<T, U> = T extends U ? T : never;

type Ex2 = MyExtract<'a' | 'b' | 'c', 'a' | 'b'>;
// 'a' extends 'a' | 'b' → 'a'
// 'b' extends 'a' | 'b' → 'b'
// 'c' extends 'a' | 'b' → never
// 结果：'a' | 'b'
```

## infer 关键字

`infer` 是条件类型中的"模式匹配"工具，可以从类型中提取一部分。

```typescript
// 提取函数返回值类型
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function getUser() {
  return { id: 1, name: '张三', age: 25 };
}

type User = MyReturnType<typeof getUser>;
// User = { id: number; name: string; age: number }

// 提取函数参数类型
type MyParameters<T> = T extends (...args: infer P) => any ? P : never;

function createUser(name: string, age: number, isAdmin: boolean) {
  return { name, age, isAdmin };
}

type Params = MyParameters<typeof createUser>;
// Params = [string, number, boolean]
```

### infer 在数组和 Promise 中的应用

```typescript
// 提取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never;

type Str = ElementOf<string[]>;    // string
type Num = ElementOf<number[]>;    // number
type Union = ElementOf<[1, 'a', true]>; // 1 | 'a' | true

// 提取 Promise 的 resolve 类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type P1 = UnwrapPromise<Promise<string>>; // string
type P2 = UnwrapPromise<Promise<number[]>>; // number[]
type P3 = UnwrapPromise<boolean>; // boolean（不是 Promise，原样返回）

// 嵌套提取：递归解包 Promise
type DeepUnwrapPromise<T> = T extends Promise<infer U>
  ? DeepUnwrapPromise<U>
  : T;

type P4 = DeepUnwrapPromise<Promise<Promise<Promise<string>>>>;
// P4 = string
```

### 用 infer 实现字符串类型操作

```typescript
// 提取字符串第一个字符
type Head<T extends string> = T extends `${infer First}${string}`
  ? First
  : never;

type H1 = Head<'hello'>; // 'h'
type H2 = Head<'world'>; // 'w'

// 提取字符串剩余部分
type Tail<T extends string> = T extends `${string}${infer Rest}`
  ? Rest
  : never;

type T1 = Tail<'hello'>; // 'ello'
type T2 = Tail<'h'>;     // ''

// 字符串转联合类型
type Split<S extends string, Sep extends string> =
  S extends `${infer First}${Sep}${infer Rest}`
    ? First | Split<Rest, Sep>
    : S;

type Tags = Split<'html,css,javascript', ','>;
// 'html' | 'css' | 'javascript'
```

## 映射类型（Mapped Types）

映射类型基于旧类型创建新类型，遍历联合类型的每个成员。

```typescript
// 基本语法
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

### 实现 Pick 和 Omit

```typescript
// Pick：从 T 中选取指定的 key
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

type UserName = MyPick<User, 'name'>;
// { name: string }

type UserNameAge = MyPick<User, 'name' | 'age'>;
// { name: string; age: number }

// Omit：从 T 中排除指定的 key
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type UserWithoutAge = MyOmit<User, 'age'>;
// { id: number; name: string }

// 分解来看：
// keyof T = 'id' | 'name' | 'age'
// Exclude<'id' | 'name' | 'age', 'age'> = 'id' | 'name'
// Pick<User, 'id' | 'name'> = { id: number; name: string }
```

### 实现 Record 和 Readonly

```typescript
// Record：构造一个 key 为 K、value 为 T 的对象类型
type MyRecord<K extends keyof any, T> = {
  [P in K]: T;
};

// keyof any 等价于 string | number | symbol

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

// 实际使用
const pages: Pages = {
  home: { title: '首页', url: '/' },
  about: { title: '关于', url: '/about' },
  contact: { title: '联系', url: '/contact' },
};

// Readonly 的深层版本
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

## 实战：类型安全的 API 请求封装

```typescript
// API 路由定义
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

// 泛型请求函数
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
  // 实际实现：替换 :id 这样的路由参数
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

// 使用时自动类型推导
async function demo() {
  // GET /users
  const users = await request('/users', 'GET', {
    params: { page: 1, size: 10 },
  });
  // users 的类型：{ list: Array<{ id: number; name: string }>; total: number }
  console.log(users.list[0].name); // 完整类型提示

  // POST /users
  const newUser = await request('/users', 'POST', {
    body: { name: '李四', email: 'lisi@example.com' },
  });
  // newUser 的类型：{ id: number; name: string; email: string }

  // GET /users/:id
  const user = await request('/users/:id', 'GET', {
    params: { id: '123' },
  });

  // 以下调用在编译期就会报错：
  // request('/users', 'DELETE');       // 报错：DELETE 需要 params
  // request('/users/:id', 'POST');     // 报错：/users/:id 没有 POST 方法
  // request('/users', 'POST', {
  //   body: { name: 123 }              // 报错：name 应为 string
  // });
}
```

## 实战：类型安全的表单验证

```typescript
// 表单字段规则
interface FieldRule<T> {
  required?: boolean;
  validate?: (value: T) => string | undefined;
  minLength?: T extends string ? number : never;
  maxLength?: T extends string ? number : never;
  min?: T extends number ? number : never;
  max?: T extends number ? number : never;
  pattern?: T extends string ? RegExp : never;
}

// 表单 Schema：每个字段的类型和规则
type FormSchema = {
  [key: string]: {
    type: string | number | boolean;
    rules: FieldRule<any>;
  };
};

// 从 Schema 提取表单值类型
type FormValues<T extends FormSchema> = {
  [K in keyof T]: T[K]['type'];
};

// 从 Schema 提取表单错误类型
type FormErrors<T extends FormSchema> = {
  [K in keyof T]?: string;
};

// 表单验证器
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

      // required 检查
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors[key] = `${String(key)} 是必填项`;
        continue;
      }

      // 字符串特定规则
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors[key] = `${String(key)} 最少 ${rules.minLength} 个字符`;
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors[key] = `${String(key)} 最多 ${rules.maxLength} 个字符`;
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors[key] = `${String(key)} 格式不正确`;
        }
      }

      // 数字特定规则
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors[key] = `${String(key)} 不能小于 ${rules.min}`;
        }
        if (rules.max !== undefined && value > rules.max) {
          errors[key] = `${String(key)} 不能大于 ${rules.max}`;
        }
      }

      // 自定义验证
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

// 定义注册表单的 Schema
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
        v.endsWith('.con') ? '请检查邮箱域名是否正确' : undefined,
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
      validate: (v: boolean) => (!v ? '请同意用户协议' : undefined),
    },
  },
};

const validator = new FormValidator(registerSchema);

// 使用时有完整类型提示
const values: FormValues<typeof registerSchema> = {
  username: 'zhangsan',
  email: 'zhangsan@example.com',
  age: 25,
  agreeTerms: true,
};

const errors = validator.validate(values);
// errors 的类型：FormErrors<typeof registerSchema>
// = { username?: string; email?: string; age?: string; agreeTerms?: string }

// 编译期类型检查
// values.username = 123;  // 报错：不能把 number 赋给 string
// values.age = '25';      // 报错：不能把 string 赋给 number
```

## 常用内置工具类型速查

```typescript
// Partial<T> - 所有属性变为可选
type PartialUser = Partial<User>;

// Required<T> - 所有属性变为必填
type RequiredUser = Required<PartialUser>;

// Readonly<T> - 所有属性变为只读
type ReadonlyUser = Readonly<User>;

// Pick<T, K> - 选取部分属性
type UserName = Pick<User, 'name' | 'id'>;

// Omit<T, K> - 排除部分属性
type UserWithoutAge = Omit<User, 'age'>;

// Record<K, T> - 构造键值对类型
type UserMap = Record<string, User>;

// Exclude<T, U> - 从联合类型中排除
type T1 = Exclude<'a' | 'b' | 'c', 'a'>; // 'b' | 'c'

// Extract<T, U> - 从联合类型中提取
type T2 = Extract<'a' | 'b' | 'c', 'a' | 'b'>; // 'a' | 'b'

// NonNullable<T> - 排除 null 和 undefined
type T3 = NonNullable<string | null | undefined>; // string

// ReturnType<T> - 获取函数返回值类型
type T4 = ReturnType<() => string>; // string

// Parameters<T> - 获取函数参数类型
type T5 = Parameters<(a: string, b: number) => void>; // [string, number]

// InstanceType<T> - 获取构造函数实例类型
class MyClass { x = 0; }
type T6 = InstanceType<typeof MyClass>; // MyClass
```

## 小结

- 泛型让类型可以参数化，是 TypeScript 类型系统的基础构建块
- 泛型约束（`extends`）限制类型参数的范围，`keyof` 约束确保 key 存在于对象上
- 条件类型（`T extends U ? X : Y`）实现类型级别的条件判断，对联合类型有自动分发行为
- `infer` 关键字实现类型模式匹配，可以从复杂类型中提取子类型
- 映射类型（`[P in keyof T]`）实现类型遍历和变换，是 `Partial`、`Pick`、`Readonly` 等工具类型的基础
- 实战中泛型能实现 API 路由的类型安全封装和表单验证，让编译期就能发现类型错误
- 多用 TypeScript 内置工具类型，理解它们的实现原理能更好地自定义类型
