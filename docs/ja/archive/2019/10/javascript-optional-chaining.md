---
title: "JavaScriptオプショナルチェーン"
date: 2019-10-17 11:29:40
tags:
  - JavaScript
readingTime: 4
description: "可选链操作符（Optional Chaining）`?.` 是 TC39 Stage 3 提案，预计将成为 ES2020 标准的一部分。它允许安全地访问深层嵌套的对象属性，而不需要在每一层都做空值检查。"
wordCount: 701
---

オプショナルチェーン演算子（Optional Chaining）`?.` は TC39 Stage 3 の提案であり、ES2020 標準の一部になる見込みです。これにより、深くネストされたオブジェクトのプロパティに安全にアクセスでき、各階層で null チェックを行う必要がなくなります。

## 問題の背景

日々の開発では、深くネストされたオブジェクトのプロパティにアクセスすることがよくあります：

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

従来の解決策は、階層ごとにチェックすることです：

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

これらの書き方はいずれも非常に冗長であり、オプショナルチェーン演算子はこの問題を解決します。

## オプショナルチェーンの基本構文

```js
// 基本用法
const lat = user?.company?.geo?.lat;
// 如果 user、company、geo 中任何一个为 null 或 undefined
// 表达式直接返回 undefined，不会报错

const city = user?.address?.city; // '北京'
const zipCode = user?.address?.zipCode; // undefined（安全，不报错）
```

## オプショナルチェーンの3つの使い方

### 1. 对象属性访问

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

### 2. 数组元素访问

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

### 3. 函数调用

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

## Null合体演算子との組み合わせ

オプショナルチェーンは `??` 演算子と組み合わせて使われることが多く、デフォルト値を提供できます：

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

## Reactプロジェクトでの応用

### 安全访问 props 和 state

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

### 安全调用事件处理器

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

### Redux 中的安全访问

```jsx
function mapStateToProps(state) {
  return {
    user: state?.auth?.user ?? null,
    notifications: state?.notifications?.items ?? [],
    settings: state?.user?.settings?.theme ?? 'light',
  };
}
```

## Node.jsでの設定

### 使用 Babel

```bash
npm install --save-dev @babel/plugin-proposal-optional-chaining
```

```json
// .babelrc
{
  "plugins": ["@babel/plugin-proposal-optional-chaining"]
}
```

### 使用 TypeScript 3.7+

TypeScript 3.7 原生支持可选链：

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

## 注意事項

### 不能用于赋值

```js
const obj = {};

// 错误：不能在赋值左侧使用可选链
obj?.a?.b = 1; // SyntaxError

// 正确的做法
if (obj?.a) {
  obj.a.b = 1;
}
```

### 与 delete 配合使用

```js
const obj = { a: { b: 1 } };

// 可以在 delete 中使用
delete obj?.a?.b;  // OK

// 等价于
if (obj?.a) {
  delete obj.a.b;
}
```

### 不要滥用

```js
// 不要对确定存在的属性使用可选链
const user = { name: '张三' };

// 不推荐
const name = user?.name;

// 推荐（确定 user 和 name 存在）
const name = user.name;
```

## コンパイル出力の比較

Babel がオプショナルチェーンをコンパイルした成果物は以下のとおりです：

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

コンパイル後のコードは確かに手書きの `&&` より長くなりますが、ソースコードの可読性は大きく向上します。

## まとめ

- オプショナルチェーン `?.` は深くネストされたプロパティに安全にアクセスし、途中の階層が null/undefined の場合は undefined を返します
- 3 つの使い方をサポートします：プロパティアクセス `?.prop`、配列インデックス `?.[index]`、関数呼び出し `?.()`
- Null 合体演算子 `??` と組み合わせてデフォルト値を提供できます
- TypeScript 3.7 以降でネイティブにサポートされ、Babel にもプラグインがあります
- 代入操作の左辺には使用できません
- 使いすぎは避け、確実に存在するプロパティにはオプショナルチェーンを使う必要はありません
