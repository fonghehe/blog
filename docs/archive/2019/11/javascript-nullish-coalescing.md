---
title: "JavaScript 空值合并运算符"
date: 2019-11-18 09:51:50
tags:
  - JavaScript
readingTime: 3
description: "空值合并运算符（Nullish Coalescing）`??` 是 TC39 提案，与可选链 `?.` 搭配使用，为 JavaScript 提供了更精确的默认值处理方式。本文详细介绍 `??` 的用法和它与 `||` 的关键区别。"
---

空值合并运算符（Nullish Coalescing）`??` 是 TC39 提案，与可选链 `?.` 搭配使用，为 JavaScript 提供了更精确的默认值处理方式。本文详细介绍 `??` 的用法和它与 `||` 的关键区别。

## 问题背景

在 JavaScript 中，使用 `||` 设置默认值是一个常见模式，但它有一个根本问题：

```js
// || 运算符在所有 falsy 值时都会使用默认值
const port = config.port || 3000;

// 问题：如果 config.port = 0（有效的端口号）
// || 会将其视为 falsy，结果是 3000 而不是 0
console.log(config.port || 3000); // 3000（错误）

// 其他 falsy 值也有同样的问题
const count = 0 || 10;        // 10（错误，0 是有效值）
const message = '' || '默认';  // '默认'（错误，空字符串可能是有意的）
const threshold = false || 0.5; // 0.5（错误，false 可能是有效配置）
```

## 空值合并运算符

`??` 只在左侧为 `null` 或 `undefined` 时才使用右侧的默认值：

```js
// 只有 null 和 undefined 触发默认值
const port = config.port ?? 3000;
console.log(config.port ?? 3000); // 0（正确）
console.log(null ?? '默认');       // '默认'
console.log(undefined ?? '默认');  // '默认'

// 其他 falsy 值保持原值
console.log(0 ?? '默认');         // 0
console.log('' ?? '默认');        // ''
console.log(false ?? '默认');     // false
console.log(NaN ?? '默认');       // NaN
```

## ?? 与 || 的对比

```js
const config = {
  port: 0,
  host: '',
  debug: false,
  timeout: null,
  retries: undefined,
};

// 使用 || —— 会错误地覆盖 falsy 值
console.log(config.port || 3000);     // 3000（错误，应该是 0）
console.log(config.host || 'localhost'); // 'localhost'（错误，应该是 ''）
console.log(config.debug || true);     // true（错误，应该是 false）

// 使用 ?? —— 只在 null/undefined 时使用默认值
console.log(config.port ?? 3000);     // 0（正确）
console.log(config.host ?? 'localhost'); // ''（正确）
console.log(config.debug ?? true);     // false（正确）
console.log(config.timeout ?? 5000);   // 5000（正确，null 触发默认值）
console.log(config.retries ?? 3);      // 3（正确，undefined 触发默认值）
```

## 使用场景

### 场景一：API 响应处理

```js
function processApiResponse(response) {
  // 后端可能返回 null 或空值
  const userId = response.userId ?? null;
  const userName = response.userName ?? '匿名用户';
  const avatar = response.avatar ?? '/default-avatar.png';

  // 如果后端返回 0 表示第一页，不应该被覆盖
  const page = response.page ?? 1;

  // 如果后端返回 0 表示无限制，不应该被覆盖
  const limit = response.limit ?? 20;

  return { userId, userName, avatar, page, limit };
}
```

### 场景二：配置对象合并

```js
function createConfig(userConfig) {
  return {
    // 用户可能有意设置 0
    port: userConfig.port ?? 8080,
    // 用户可能有意设置空字符串
    host: userConfig.host ?? '127.0.0.1',
    // 用户可能有意关闭调试
    debug: userConfig.debug ?? false,
    // 以下只能是 null/undefined 时才用默认值
    timeout: userConfig.timeout ?? 5000,
    maxConnections: userConfig.maxConnections ?? 100,
  };
}

// 用户配置
createConfig({ port: 0 });
// { port: 0, host: '127.0.0.1', debug: false, timeout: 5000, maxConnections: 100 }
```

### 场景三：表单默认值

```js
function getFormDefaults(savedData) {
  return {
    quantity: savedData?.quantity ?? 1,      // 0 时不应该被覆盖为 1
    discount: savedData?.discount ?? 0,      // 0 折扣是有效值
    notes: savedData?.notes ?? '',           // 空字符串是有效输入
    priority: savedData?.priority ?? 'normal',
  };
}
```

### 场景四：环境变量处理

```js
// 0 是有效的环境变量值
const PORT = process.env.PORT ?? 3000;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// 注意：process.env 中不存在的值是 undefined
// 所以 ?? 在这里工作得很好
```

## 与可选链的配合

`??` 和 `?.` 是最佳搭档：

```js
const user = {
  profile: {
    settings: {
      theme: null,
      fontSize: 0,
    }
  }
};

// 组合使用
const theme = user?.profile?.settings?.theme ?? 'light';
// 'light'（theme 是 null）

const fontSize = user?.profile?.settings?.fontSize ?? 16;
// 0（fontSize 是 0，不是 null/undefined，保持原值）

const language = user?.profile?.settings?.language ?? 'zh-CN';
// 'zh-CN'（language 不存在，undefined 触发默认值）
```

## 在 React 中的使用

```jsx
// 组件 props 默认值
function UserCard({ name, age, email, role }) {
  return (
    <div>
      <h2>{name ?? '未设置姓名'}</h2>
      <p>年龄: {age ?? '未填写'}</p>
      {/* 0 岁婴儿不应该显示为 "未填写" */}
      <p>邮箱: {email ?? '未绑定'}</p>
      <p>角色: {role ?? '普通用户'}</p>
    </div>
  );
}

// 条件渲染
function Notification({ message, count }) {
  return (
    <div>
      <p>{message ?? '暂无消息'}</p>
      {/* count = 0 表示无通知，是有效状态 */}
      <span>未读: {count ?? 0}</span>
    </div>
  );
}
```

## 不能与 && 和 || 混用

`??` 不能直接与 `&&` 或 `||` 混合使用，必须用括号明确优先级：

```js
// 错误：SyntaxError
const result = a ?? b || c;

// 正确：使用括号
const result1 = (a ?? b) || c;
const result2 = a ?? (b || c);

// 常见模式
const value = config.value ?? (defaults.value || 'fallback');
```

## Babel 配置

```bash
npm install --save-dev @babel/plugin-proposal-nullish-coalescing-operator
```

```json
// .babelrc
{
  "plugins": ["@babel/plugin-proposal-nullish-coalescing-operator"]
}
```

编译后的产物：

```js
// 输入
const value = obj.prop ?? 'default';

// 输出
const value = obj.prop !== null && obj.prop !== void 0
  ? obj.prop
  : 'default';
```

## TypeScript 支持

TypeScript 3.7+ 原生支持空值合并运算符：

```typescript
interface Config {
  port?: number;
  host?: string;
  debug?: boolean;
}

function createServer(config: Config) {
  const port: number = config.port ?? 8080;
  const host: string = config.host ?? 'localhost';
  const debug: boolean = config.debug ?? false;

  return { port, host, debug };
}
```

## 小结

- `??` 只在左侧为 `null` 或 `undefined` 时才使用右侧默认值
- 与 `||` 的关键区别：`||` 对所有 falsy 值（0、''、false、NaN）都触发默认值
- 适合处理配置项、API 响应、表单值等可能有意为 falsy 的场景
- 经常与可选链 `?.` 配合使用
- 不能直接与 `&&` 或 `||` 混用，需要括号明确优先级
- TypeScript 3.7+ 和 Babel 都支持
