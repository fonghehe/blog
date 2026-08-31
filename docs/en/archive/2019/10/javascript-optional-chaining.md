---
title: "JavaScript Optional Chaining"
date: 2019-10-17 11:29:40
tags:
  - JavaScript
readingTime: 3
description: "The optional chaining operator (`?.`) was a TC39 Stage 3 proposal and was expected to become part of ES2020. It lets you safely access deeply nested object properties without performing a null check at every level."
wordCount: 264
---

The optional chaining operator (`?.`) was a TC39 Stage 3 proposal and was expected to become part of ES2020. It lets you safely access deeply nested object properties without performing a null check at every level.

## Problem Background

In day-to-day development, we often need to access deeply nested object properties:

```js
// 从 API 返回的用户数据
const user = {
  name: '张三',
  address: {
    city: '北京',
    geo: {
      lat: 39.9042,
      lng: 116.4074
    }
  }
};

// 问题：如果某层属性不存在，会报 TypeError
const lat = user.address.geo.lat; // OK
const lat2 = user.company.geo.lat; // TypeError: Cannot read property 'geo' of undefined
```

The traditional approach is to check each level manually:

```js
// 方式一：if 判断
let lat;
if (user && user.company && user.company.geo) {
  lat = user.company.geo.lat;
}

// 方式二：三元运算符链
const lat = user
  ? user.company
    ? user.company.geo
      ? user.company.geo.lat
      : undefined
    : undefined
  : undefined;

// 方式三：逻辑与短路
const lat = user && user.company && user.company.geo && user.company.geo.lat;
```

All of these approaches are very verbose, and the optional chaining operator solves exactly this problem.

## Optional Chaining Basic Syntax

```js
// 基本用法
const lat = user?.company?.geo?.lat;
// 如果 user、company、geo 中任何一个为 null 或 undefined
// 表达式直接返回 undefined，不会报错

const city = user?.address?.city; // '北京'
const zipCode = user?.address?.zipCode; // undefined（安全，不报错）
```

## Three Usages of Optional Chaining

### 1. Accessing Object Properties

```js
const user = {
  profile: {
    avatar: 'https://example.com/avatar.jpg'
  }
};

// 安全访问
const avatar = user?.profile?.avatar;
// 'https://example.com/avatar.jpg'

const company = user?.company?.name;
// undefined（不报错）

// 对比传统写法
const companyOld = user && user.company && user.company.name;
```

### 2. Accessing Array Elements

```js
const users = [
  { name: '张三' },
  { name: '李四' }
];

// 安全访问数组元素
const firstUser = users?.[0]?.name;
// '张三'

const tenthUser = users?.[9]?.name;
// undefined（不报错）

// 实际场景：API 返回的数据
const response = {
  data: {
    items: [{ id: 1, title: '文章一' }]
  }
};

const firstTitle = response?.data?.items?.[0]?.title;
// '文章一'
```

### 3. Function Calls

```js
const api = {
  getUser: (id) => ({ id, name: '张三' })
};

// 安全调用函数
const user = api?.getUser?.(123);
// { id: 123, name: '张三' }

const result = api?.getNonExistent?.();
// undefined（不报错）

// 实际场景：回调函数安全调件
function processData(data, callback) {
  const result = transform(data);
  callback?.(result);  // 如果 callback 是 undefined，不会报错
}

processData(input);         // 不传回调，正常工作
processData(input, console.log);  // 传回调，正常调用
```

## Using with Nullish Coalescing Operator

Optional chaining is often paired with the `??` operator to provide default values:

```js
const user = {
  profile: {
    nickname: '小明'
  }
};

// 组合使用
const displayName = user?.profile?.nickname ?? '匿名用户';
// '小明'

const email = user?.profile?.email ?? '未设置';
// '未设置'

// 对比 || 运算符
const count = user?.profile?.age || 18;
// 18（age 为 0 时也会被替换为 18）

const count2 = user?.profile?.age ?? 18;
// 18（age 为 0 时保持为 0）
```

## Usage in React Projects

### Safely Accessing Props and State

```jsx
function UserProfile({ user }) {
  return (
    <div>
      <h2>{user?.name ?? '未登录'}</h2>
      <p>邮箱: {user?.profile?.email ?? '未设置'}</p>
      <p>城市: {user?.address?.city ?? '未知'}</p>
      <img
        src={user?.profile?.avatar ?? '/default-avatar.png'}
        alt="头像"
      />
    </div>
  );
}
```

### Safely Calling Event Handlers

```jsx
function Button({ onClick, onMouseEnter }) {
  return (
    <button
      onClick={(e) => onClick?.(e)}
      onMouseEnter={(e) => onMouseEnter?.(e)}
    >
      点击我
    </button>
  );
}
```

### Safe Access in Redux

```jsx
function mapStateToProps(state) {
  return {
    user: state?.auth?.user ?? null,
    notifications: state?.notifications?.items ?? [],
    settings: state?.user?.settings?.theme ?? 'light',
  };
}
```

## Configuration in Node.js

### Using Babel

```bash
npm install --save-dev @babel/plugin-proposal-optional-chaining
```

```json
// .babelrc
{
  "plugins": ["@babel/plugin-proposal-optional-chaining"]
}
```

### Using TypeScript 3.7+

TypeScript 3.7 supports optional chaining natively:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

```typescript
interface User {
  name: string;
  address?: {
    city: string;
    geo?: {
      lat: number;
      lng: number;
    };
  };
}

function getLatitude(user: User): number | undefined {
  return user.address?.geo?.lat;
}
```

## Important Notes

### Can't Be Used on the Left Side of an Assignment

```js
const obj = {};

// 错误：不能在赋值左侧使用可选链
obj?.a?.b = 1; // SyntaxError

// 正确的做法
if (obj?.a) {
  obj.a.b = 1;
}
```

### Using with `delete`

```js
const obj = { a: { b: 1 } };

// 可以在 delete 中使用
delete obj?.a?.b;  // OK

// 等价于
if (obj?.a) {
  delete obj.a.b;
}
```

### Don't Overuse It

```js
// 不要对确定存在的属性使用可选链
const user = { name: '张三' };

// 不推荐
const name = user?.name;

// 推荐（确定 user 和 name 存在）
const name = user.name;
```

## Compiled Output Comparison

Here's what Babel compiles optional chaining into:

```js
// 输入
const lat = user?.address?.geo?.lat;

// 输出（简化）
var _user, _user$address, _user$address$geo;
const lat =
  (_user = user) === null || _user === void 0
    ? void 0
    : (_user$address = _user.address) === null || _user$address === void 0
      ? void 0
      : (_user$address$geo = _user$address.geo) === null ||
        _user$address$geo === void 0
        ? void 0
        : _user$address$geo.lat;
```

As you can see, the compiled output is indeed longer than hand-written `&&` checks, but source-level readability improves dramatically.

## Summary

- The `?.` operator safely accesses deeply nested properties, returning `undefined` when any intermediate level is `null`/`undefined`
- It supports three forms: property access (`?.prop`), array indexing (`?.[index]`), and function calls (`?.()`)
- Pair it with the nullish coalescing operator `??` to provide default values
- Supported natively in TypeScript 3.7+ and via a Babel plugin
- Can't be used on the left side of an assignment
- Don't overuse it—properties you know exist don't need optional chaining
