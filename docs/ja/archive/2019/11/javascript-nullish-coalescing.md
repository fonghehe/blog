---
title: "JavaScript Null合体演算子"
date: 2019-11-18 09:51:50
tags:
  - JavaScript
readingTime: 3
description: "空值合并运算符（Nullish Coalescing）`??` 是 TC39 提案，与可选链 `?.` 搭配使用，为 JavaScript 提供了更精确的默认值处理方式。本文详细介绍 `??` 的用法和它与 `||` 的关键区别。"
wordCount: 582
---

Null 合体演算子（Nullish Coalescing）`??` は TC39 の提案であり、オプショナルチェーン `?.` と組み合わせることで、JavaScript により正確なデフォルト値の処理方法を提供します。本記事では `??` の使い方と、それが `||` と決定的に異なる点を詳しく解説します。

## 問題の背景

JavaScript で `||` を使ってデフォルト値を設定するのは一般的なパターンですが、根本的な問題があります：

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

## Null合体演算子

`??` は左辺が `null` または `undefined` の場合にのみ、右辺のデフォルト値を使います：

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

## ?? と || の比較

```js
const config = {
  port: 0,
  host: '',
  debug: false,
  timeout: null,
  retries: undefined,
};

// 使用例 || —— 会错误地覆盖 falsy 值
console.log(config.port || 3000);     // 3000（错误，应该是 0）
console.log(config.host || 'localhost'); // 'localhost'（错误，应该是 ''）
console.log(config.debug || true);     // true（错误，应该是 false）

// 使用例 ?? —— 只在 null/undefined 时使用默认值
console.log(config.port ?? 3000);     // 0（正确）
console.log(config.host ?? 'localhost'); // ''（正确）
console.log(config.debug ?? true);     // false（正确）
console.log(config.timeout ?? 5000);   // 5000（正确，null 触发默认值）
console.log(config.retries ?? 3);      // 3（正确，undefined 触发默认值）
```

## 使用シーン

### ケース 1：API レスポンスの処理

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

### ケース 2：設定オブジェクトのマージ

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

### ケース 3：フォームのデフォルト値

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

### ケース 4：環境変数の処理

```js
// 0 是有效的环境变量值
const PORT = process.env.PORT ?? 3000;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// 注意：process.env 中不存在的值是 undefined
// 所以 ?? 在这里工作得很好
```

## オプショナルチェーンとの組み合わせ

`??` と `?.` は最強の組み合わせです：

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

## Reactでの使い方

### コンポーネントの props のデフォルト値

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

## && と || と混在できない

`??` は `&&` や `||` と直接混ぜて書くことはできず、優先順位を明示するために括弧が必要です：

```js
// 错误：SyntaxError
const result = a ?? b || c;

// 正しい：使用括号
const result1 = (a ?? b) || c;
const result2 = a ?? (b || c);

// 常见模式
const value = config.value ?? (defaults.value || 'fallback');
```

## Babelの設定

```bash
npm install --save-dev @babel/plugin-proposal-nullish-coalescing-operator
```

```json
// .babelrc
{
  "plugins": ["@babel/plugin-proposal-nullish-coalescing-operator"]
}
```

コンパイル後の出力：

```js
// 入力
const value = obj.prop ?? 'default';

// 输出
const value = obj.prop !== null && obj.prop !== void 0
  ? obj.prop
  : 'default';
```

## TypeScript 支持

TypeScript 3.7 以降は Null 合体演算子をネイティブにサポートしています：

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

## まとめ

- `??` は左辺が `null` または `undefined` の場合にのみ、右辺のデフォルト値を使います
- `||` との決定的な違い：`||` はすべての falsy 値（0、''、false、NaN）に対してデフォルト値を適用します
- 設定項目、API レスポンス、フォーム値など、意図的に falsy になる可能性がある場面に適しています
- オプショナルチェーン `?.` と組み合わせて使うことが多いです
- `&&` や `||` と直接混ぜて書くことはできず、優先順位を明示するために括弧が必要です
- TypeScript 3.7 以降と Babel の両方でサポートされています
