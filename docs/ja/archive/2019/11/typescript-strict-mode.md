---
title: "TypeScript strictモードのベストプラクティス"
date: 2019-11-20 09:57:07
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 的 `strict` 模式启用了一系列严格的类型检查选项，能在编译期捕获大量潜在错误。对于已有项目来说，启用 strict 模式可能会带来大量报错。本文将详细介绍 strict 模式的各个选项，以及如何渐进式地在项目中启用严格类型检查。"
---

TypeScript 的 `strict` 模式启用了一系列严格的类型检查选项，能在编译期捕获大量潜在错误。对于已有项目来说，启用 strict 模式可能会带来大量报错。本文将详细介绍 strict 模式的各个选项，以及如何渐进式地在项目中启用严格类型检查。

## strictモードに含まれるもの

`strict: true` 实际上等同于开启以下所有选项：

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

禁止隐式的 `any` 类型。所有变量、参数都必须有明确的类型：

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

常见报错与解决：

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

`null` 和 `undefined` 不再是所有类型的子类型，必须显式处理：

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

在实际项目中的应用：

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

函数参数类型检查更严格，使用逆变（contravariance）检查：

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

类属性必须在构造函数中初始化，或有默认值：

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

## 段階的なstrictの有効化

对于已有项目，不建议一步到位启用所有 strict 选项。可以渐进式迁移：

### 第一步：启用 noImplicitAny

```json
{
  "compilerOptions": {
    "noImplicitAny": true
  }
}
```

处理策略：对确实不知道类型的参数，暂时使用 `any` 或 `unknown`：

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

### 第二步：启用 strictNullChecks

这是最难的一步，因为现有代码很少处理 null：

```json
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

使用 `// @ts-ignore` 或 `as any` 临时绕过，逐步修复：

```ts
// 临时绕过
// @ts-ignore
const name: string = userData.name;

// 逐步修复
const name: string = userData?.name ?? 'unknown';
```

### 第三步：启用其余选项

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## anyの代わりにunknownを使う

`unknown` 是类型安全的 `any`：

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

## よく使う型ガード

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

## まとめ

- `strict: true` 包含 7 个严格类型检查选项
- `noImplicitAny` 禁止隐式 any，`strictNullChecks` 强制处理 null/undefined
- 建议渐进式启用：先 noImplicitAny，再 strictNullChecks，最后全部开启
- 使用 `unknown` 替代 `any`，提高类型安全性
- 类型守卫（type guard）是处理联合类型的关键工具
- 临时使用 `// @ts-ignore` 绕过报错，逐步修复
- strict 模式虽然前期投入大，但能显著减少运行时错误
