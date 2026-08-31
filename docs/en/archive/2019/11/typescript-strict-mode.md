---
title: "TypeScript strict Mode Best Practices"
date: 2019-11-20 09:57:07
tags:
  - TypeScript
readingTime: 3
description: "TypeScript's `strict` mode turns on a set of rigorous type-checking options that catch many potential errors at compile time. For an existing project, enabling strict mode can surface a flood of errors. This article details each option and shows how to adopt strict type checking incrementally."
wordCount: 292
---

TypeScript's `strict` mode turns on a set of rigorous type-checking options that catch many potential errors at compile time. For an existing project, enabling strict mode can surface a flood of errors. This article details each option and shows how to adopt strict type checking incrementally.

## What strict Mode Includes

`strict: true` is effectively shorthand for enabling all of the following options:

```json
{
  "compilerOptions": {
    "strict": true,
    // 等价于同时开启：
    // "noImplicitAny": true,
    // "strictNullChecks": true,
    // "strictFunctionTypes": true,
    // "strictBindCallApply": true,
    // "strictPropertyInitialization": true,
    // "noImplicitThis": true,
    // "alwaysStrict": true
  }
}
```

## noImplicitAny

Disallows implicit `any` types. Every variable and parameter must have an explicit type:

```ts
// 关闭时（宽松模式）：参数隐式为 any
function add(a, b) {
  return a + b;
}

// 开启后：必须显式标注类型
function add(a: number, b: number): number {
  return a + b;
}

// 或者用类型推断（参数还是需要标注）
const multiply = (a: number, b: number) => a * b;
```

Common errors and how to fix them:

```ts
// 报错：Parameter 'event' implicitly has an 'any' type
// document.addEventListener('click', (event) => {
//   console.log(event.clientX);
// });

// 解决：标注正确的事件类型
document.addEventListener('click', (event: MouseEvent) => {
  console.log(event.clientX);
});

// 报错：Binding element 'name' implicitly has an 'any' type
// function greet({ name }) {
//   return `Hello, ${name}`;
// }

// 解决：标注解构参数的类型
function greet({ name }: { name: string }) {
  return `Hello, ${name}`;
}

// 或者使用 interface
interface User {
  name: string;
  age?: number;
}

function greet(user: User) {
  return `Hello, ${user.name}`;
}
```

## strictNullChecks

`null` and `undefined` are no longer subtypes of every type, so they must be handled explicitly:

```ts
// 关闭时：可以忽略 null
const name: string = null; // 不报错

// 开启后：null 不能赋值给 string
const name: string | null = null; // 必须显式声明

// 常见场景
function getLength(str: string | undefined): number {
  // 报错：Object is possibly 'undefined'
  // return str.length;

  // 解决1：类型守卫
  if (str === undefined) return 0;
  return str.length;

  // 解决2：可选链（TypeScript 3.7+）
  // return str?.length ?? 0;

  // 解决3：非空断言（确定不为 null 时使用）
  // return str!.length;
}
```

Applying it in a real project:

```ts
interface User {
  id: number;
  name: string;
  email: string | null;     // 可能没有邮箱
  avatar?: string;          // 可选属性
}

function displayUser(user: User | null) {
  // 必须检查 null
  if (!user) {
    return '<p>未登录</p>';
  }

  // 必须处理可能为 null 的属性
  const emailDisplay = user.email ?? '未绑定邮箱';
  const avatarUrl = user.avatar ?? '/default-avatar.png';

  return `
    <img src="${avatarUrl}" alt="${user.name}" />
    <p>${user.name}</p>
    <p>${emailDisplay}</p>
  `;
}

// 使用数组方法时
function findUser(id: number): User | undefined {
  return users.find(u => u.id === id);
}

const user = findUser(1);
// user 可能是 undefined
if (user) {
  console.log(user.name); // 安全
}

// Array.find 返回 T | undefined
const firstUser = users[0]; // 报错：可能越界
const firstUserSafe = users[0]; // 需要检查
```

## strictFunctionTypes

Function parameter types are checked more strictly, using contravariance:

```ts
// 关闭时：参数类型是双向协变的
type Handler = (event: Event) => void;
type MouseHandler = (event: MouseEvent) => void;

const mouseHandler: MouseHandler = (e) => console.log(e.clientX);
const handler: Handler = mouseHandler; // 不报错

// 开启后：参数类型是逆变的
// MouseHandler 的参数比 Handler 更具体
// 不能将 MouseHandler 赋值给 Handler
// 因为 Handler 可能被调用时传入非 MouseEvent 的 Event
```

## strictPropertyInitialization

Class properties must be initialized in the constructor or have a default value:

```ts
class User {
  // 报错：Property 'name' has no initializer
  // name: string;

  // 解决1：在构造函数中初始化
  name: string;
  constructor(name: string) {
    this.name = name;
  }

  // 解决2：使用默认值
  role: string = 'user';

  // 解决3：使用 ! 断言（确定会在其他地方初始化）
  avatar!: string;

  // 解决4：可选属性
  nickname?: string;
}
```

## Gradually Enabling strict

For an existing project, don't flip on every strict option at once. Migrate incrementally instead:

### Step 1: Enable noImplicitAny

```json
{
  "compilerOptions": {
    "noImplicitAny": true
  }
}
```

Strategy: for parameters whose type you genuinely don't know yet, fall back to `any` or `unknown` temporarily:

```ts
// 对第三方库的回调
function handleResponse(data: any) {
  // 逐步添加类型
}

// 使用 unknown 更安全（需要类型守卫）
function handleResponseSafe(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // 可以安全访问
  }
}
```

### Step 2: Enable strictNullChecks

This is the hardest step, because most existing code doesn't handle null:

```json
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

Use `// @ts-ignore` or `as any` as a temporary escape hatch, then fix gradually:

```ts
// 临时绕过
// @ts-ignore
const name: string = userData.name;

// 逐步修复
const name: string = userData?.name ?? 'unknown';
```

### Step 3: Enable the Rest

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## Using unknown Instead of any

`unknown` is the type-safe version of `any`:

```ts
// any：关闭类型检查
function processAny(data: any) {
  data.foo.bar; // 不报错，但运行时可能出错
}

// unknown：强制类型检查
function processUnknown(data: unknown) {
  // data.foo.bar; // 报错：'data' is of type 'unknown'

  // 必须先检查类型
  if (typeof data === 'object' && data !== null && 'foo' in data) {
    const obj = data as { foo: { bar: string } };
    obj.foo.bar; // 安全
  }
}

// 实际场景：API 响应处理
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();

  // 类型守卫验证
  if (!isValidUser(data)) {
    throw new Error('Invalid user data');
  }

  return data;
}

function isValidUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  );
}
```

## Common Type Guards

```ts
// typeof 类型守卫
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// instanceof 类型守卫
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// 自定义类型守卫
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'data' in value
  );
}
```

## Summary

- `strict: true` bundles 7 strict type-checking options
- `noImplicitAny` bans implicit any; `strictNullChecks` forces you to handle null/undefined
- Enable incrementally: start with noImplicitAny, then strictNullChecks, then turn on everything
- Prefer `unknown` over `any` to improve type safety
- Type guards are the key tool for working with union types
- Use `// @ts-ignore` as a temporary workaround, then fix the errors over time
- Strict mode costs more upfront, but it noticeably cuts down runtime errors
