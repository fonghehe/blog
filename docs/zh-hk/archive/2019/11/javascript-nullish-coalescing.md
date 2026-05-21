---
title: "JavaScript 空值合併運算符"
date: 2019-11-18 09:51:50
tags:
  - JavaScript
readingTime: 3
description: "空值合併運算符（Nullish Coalescing）`??` 是 TC39 提案，與可選鏈 `?.` 搭配使用，為 JavaScript 提供了更精確的默認值處理方式。本文詳細介紹 `??` 的用法和它與 `||` 的關鍵區別。"
wordCount: 344
---

空值合併運算符（Nullish Coalescing）`??` 是 TC39 提案，與可選鏈 `?.` 搭配使用，為 JavaScript 提供了更精確的默認值處理方式。本文詳細介紹 `??` 的用法和它與 `||` 的關鍵區別。

## 問題背景

在 JavaScript 中，使用 `||` 設置默認值是一個常見模式，但它有一個根本問題：

```js
// || 運算符在所有 falsy 值時都會使用默認值
const port = config.port || 3000;

// 問題：如果 config.port = 0（有效的端口號）
// || 會將其視為 falsy，結果是 3000 而不是 0
console.log(config.port || 3000); // 3000（錯誤）

// 其他 falsy 值也有同樣的問題
const count = 0 || 10;        // 10（錯誤，0 是有效值）
const message = '' || '默認';  // '默認'（錯誤，空字符串可能是有意的）
const threshold = false || 0.5; // 0.5（錯誤，false 可能是有效配置）
```

## 空值合併運算符

`??` 只在左側為 `null` 或 `undefined` 時才使用右側的默認值：

```js
// 只有 null 和 undefined 觸發默認值
const port = config.port ?? 3000;
console.log(config.port ?? 3000); // 0（正確）
console.log(null ?? '默認');       // '默認'
console.log(undefined ?? '默認');  // '默認'

// 其他 falsy 值保持原值
console.log(0 ?? '默認');         // 0
console.log('' ?? '默認');        // ''
console.log(false ?? '默認');     // false
console.log(NaN ?? '默認');       // NaN
```

## ?? 與 || 的對比

```js
const config = {
  port: 0,
  host: '',
  debug: false,
  timeout: null,
  retries: undefined,
};

// 使用 || —— 會錯誤地覆蓋 falsy 值
console.log(config.port || 3000);     // 3000（錯誤，應該是 0）
console.log(config.host || 'localhost'); // 'localhost'（錯誤，應該是 ''）
console.log(config.debug || true);     // true（錯誤，應該是 false）

// 使用 ?? —— 只在 null/undefined 時使用默認值
console.log(config.port ?? 3000);     // 0（正確）
console.log(config.host ?? 'localhost'); // ''（正確）
console.log(config.debug ?? true);     // false（正確）
console.log(config.timeout ?? 5000);   // 5000（正確，null 觸發默認值）
console.log(config.retries ?? 3);      // 3（正確，undefined 觸發默認值）
```

## 使用場景

### 場景一：API 響應處理

```js
function processApiResponse(response) {
  // 後端可能返回 null 或空值
  const userId = response.userId ?? null;
  const userName = response.userName ?? '匿名用户';
  const avatar = response.avatar ?? '/default-avatar.png';

  // 如果後端返回 0 表示第一頁，不應該被覆蓋
  const page = response.page ?? 1;

  // 如果後端返回 0 表示無限制，不應該被覆蓋
  const limit = response.limit ?? 20;

  return { userId, userName, avatar, page, limit };
}
```

### 場景二：配置對象合併

```js
function createConfig(userConfig) {
  return {
    // 用户可能有意設置 0
    port: userConfig.port ?? 8080,
    // 用户可能有意設置空字符串
    host: userConfig.host ?? '127.0.0.1',
    // 用户可能有意關閉調試
    debug: userConfig.debug ?? false,
    // 以下只能是 null/undefined 時才用默認值
    timeout: userConfig.timeout ?? 5000,
    maxConnections: userConfig.maxConnections ?? 100,
  };
}

// 用户配置
createConfig({ port: 0 });
// { port: 0, host: '127.0.0.1', debug: false, timeout: 5000, maxConnections: 100 }
```

### 場景三：表單默認值

```js
function getFormDefaults(savedData) {
  return {
    quantity: savedData?.quantity ?? 1,      // 0 時不應該被覆蓋為 1
    discount: savedData?.discount ?? 0,      // 0 折扣是有效值
    notes: savedData?.notes ?? '',           // 空字符串是有效輸入
    priority: savedData?.priority ?? 'normal',
  };
}
```

### 場景四：環境變量處理

```js
// 0 是有效的環境變量值
const PORT = process.env.PORT ?? 3000;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// 注意：process.env 中不存在的值是 undefined
// 所以 ?? 在這裏工作得很好
```

## 與可選鏈的配合

`??` 和 `?.` 是最佳搭檔：

```js
const user = {
  profile: {
    settings: {
      theme: null,
      fontSize: 0,
    }
  }
};

// 組合使用
const theme = user?.profile?.settings?.theme ?? 'light';
// 'light'（theme 是 null）

const fontSize = user?.profile?.settings?.fontSize ?? 16;
// 0（fontSize 是 0，不是 null/undefined，保持原值）

const language = user?.profile?.settings?.language ?? 'zh-CN';
// 'zh-CN'（language 不存在，undefined 觸發默認值）
```

## 在 React 中的使用

```jsx
// 組件 props 默認值
function UserCard({ name, age, email, role }) {
  return (
    <div>
      <h2>{name ?? '未設置姓名'}</h2>
      <p>年齡: {age ?? '未填寫'}</p>
      {/* 0 歲嬰兒不應該顯示為 "未填寫" */}
      <p>郵箱: {email ?? '未綁定'}</p>
      <p>角色: {role ?? '普通用户'}</p>
    </div>
  );
}

// 條件渲染
function Notification({ message, count }) {
  return (
    <div>
      <p>{message ?? '暫無消息'}</p>
      {/* count = 0 表示無通知，是有效狀態 */}
      <span>未讀: {count ?? 0}</span>
    </div>
  );
}
```

## 不能與 && 和 || 混用

`??` 不能直接與 `&&` 或 `||` 混合使用，必須用括號明確優先級：

```js
// 錯誤：SyntaxError
const result = a ?? b || c;

// 正確：使用括號
const result1 = (a ?? b) || c;
const result2 = a ?? (b || c);

// 常見模式
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

編譯後的產物：

```js
// 輸入
const value = obj.prop ?? 'default';

// 輸出
const value = obj.prop !== null && obj.prop !== void 0
  ? obj.prop
  : 'default';
```

## TypeScript 支持

TypeScript 3.7+ 原生支持空值合併運算符：

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

## 小結

- `??` 只在左側為 `null` 或 `undefined` 時才使用右側默認值
- 與 `||` 的關鍵區別：`||` 對所有 falsy 值（0、''、false、NaN）都觸發默認值
- 適合處理配置項、API 響應、表單值等可能有意為 falsy 的場景
- 經常與可選鏈 `?.` 配合使用
- 不能直接與 `&&` 或 `||` 混用，需要括號明確優先級
- TypeScript 3.7+ 和 Babel 都支持
