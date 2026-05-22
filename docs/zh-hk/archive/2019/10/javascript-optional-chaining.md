---
title: "JavaScript 可選鏈 Optional Chaining：落地路徑與實戰建議"
date: 2019-10-17 11:29:40
tags:
  - JavaScript
readingTime: 3
description: "可選鏈操作符（Optional Chaining）`?.` 是 TC39 Stage 3 提案，預計將成為 ES2020 標準的一部分。它允許安全地訪問深層巢狀的對象屬性，而不需要在每一層都做空值檢查。"
wordCount: 423
---

可選鏈操作符（Optional Chaining）`?.` 是 TC39 Stage 3 提案，預計將成為 ES2020 標準的一部分。它允許安全地訪問深層巢狀的對象屬性，而不需要在每一層都做空值檢查。

## 問題背景

在日常開發中，我們經常需要訪問深層巢狀的對象屬性：

```js
// 從 API 返回的用户數據
const user = {
  name: '張三',
  address: {
    city: '北京',
    geo: {
      lat: 39.9042,
      lng: 116.4074
    }
  }
};

// 問題：如果某層屬性不存在，會報 TypeError
const lat = user.address.geo.lat; // OK
const lat2 = user.company.geo.lat; // TypeError: Cannot read property 'geo' of undefined
```

傳統的解決方式是逐層檢查：

```js
// 方式一：if 判斷
let lat;
if (user && user.company && user.company.geo) {
  lat = user.company.geo.lat;
}

// 方式二：三元運算符鏈
const lat = user
  ? user.company
    ? user.company.geo
      ? user.company.geo.lat
      : undefined
    : undefined
  : undefined;

// 方式三：邏輯與短路
const lat = user && user.company && user.company.geo && user.company.geo.lat;
```

這些寫法都非常冗長，可選鏈操作符解決了這個問題。

## 可選鏈基本語法

```js
// 基本用法
const lat = user?.company?.geo?.lat;
// 如果 user、company、geo 中任何一個為 null 或 undefined
// 表達式直接返回 undefined，不會報錯

const city = user?.address?.city; // '北京'
const zipCode = user?.address?.zipCode; // undefined（安全，不報錯）
```

## 可選鏈的三種用法

### 1. 對象屬性訪問

```js
const user = {
  profile: {
    avatar: 'https://example.com/avatar.jpg'
  }
};

// 安全訪問
const avatar = user?.profile?.avatar;
// 'https://example.com/avatar.jpg'

const company = user?.company?.name;
// undefined（不報錯）

// 對比傳統寫法
const companyOld = user && user.company && user.company.name;
```

### 2. 數組元素訪問

```js
const users = [
  { name: '張三' },
  { name: '李四' }
];

// 安全訪問數組元素
const firstUser = users?.[0]?.name;
// '張三'

const tenthUser = users?.[9]?.name;
// undefined（不報錯）

// 實際場景：API 返回的數據
const response = {
  data: {
    items: [{ id: 1, title: '文章一' }]
  }
};

const firstTitle = response?.data?.items?.[0]?.title;
// '文章一'
```

### 3. 函數調用

```js
const api = {
  getUser: (id) => ({ id, name: '張三' })
};

// 安全調用函數
const user = api?.getUser?.(123);
// { id: 123, name: '張三' }

const result = api?.getNonExistent?.();
// undefined（不報錯）

// 實際場景：回調函數安全調件
function processData(data, callback) {
  const result = transform(data);
  callback?.(result);  // 如果 callback 是 undefined，不會報錯
}

processData(input);         // 不傳回調，正常工作
processData(input, console.log);  // 傳回調，正常調用
```

## 與空值合併運算符配合使用

可選鏈經常與 `??` 運算符配合，提供默認值：

```js
const user = {
  profile: {
    nickname: '小明'
  }
};

// 組合使用
const displayName = user?.profile?.nickname ?? '匿名用户';
// '小明'

const email = user?.profile?.email ?? '未設置';
// '未設置'

// 對比 || 運算符
const count = user?.profile?.age || 18;
// 18（age 為 0 時也會被替換為 18）

const count2 = user?.profile?.age ?? 18;
// 18（age 為 0 時保持為 0）
```

## 在 React 項目中的應用

### 安全訪問 props 和 state

```jsx
function UserProfile({ user }) {
  return (
    <div>
      <h2>{user?.name ?? '未登錄'}</h2>
      <p>郵箱: {user?.profile?.email ?? '未設置'}</p>
      <p>城市: {user?.address?.city ?? '未知'}</p>
      <img
        src={user?.profile?.avatar ?? '/default-avatar.png'}
        alt="頭像"
      />
    </div>
  );
}
```

### 安全調用事件處理器

```jsx
function Button({ onClick, onMouseEnter }) {
  return (
    <button
      onClick={(e) => onClick?.(e)}
      onMouseEnter={(e) => onMouseEnter?.(e)}
    >
      點擊我
    </button>
  );
}
```

### Redux 中的安全訪問

```jsx
function mapStateToProps(state) {
  return {
    user: state?.auth?.user ?? null,
    notifications: state?.notifications?.items ?? [],
    settings: state?.user?.settings?.theme ?? 'light',
  };
}
```

## 在 Node.js 中的設定

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

TypeScript 3.7 原生支持可選鏈：

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

### 不能用於賦值

```js
const obj = {};

// 錯誤：不能在賦值左側使用可選鏈
obj?.a?.b = 1; // SyntaxError

// 正確的做法
if (obj?.a) {
  obj.a.b = 1;
}
```

### 與 delete 配合使用

```js
const obj = { a: { b: 1 } };

// 可以在 delete 中使用
delete obj?.a?.b;  // OK

// 等價於
if (obj?.a) {
  delete obj.a.b;
}
```

### 不要濫用

```js
// 不要對確定存在的屬性使用可選鏈
const user = { name: '張三' };

// 不推薦
const name = user?.name;

// 推薦（確定 user 和 name 存在）
const name = user.name;
```

## 編譯產物對比

Babel 編譯可選鏈的產物：

```js
// 輸入
const lat = user?.address?.geo?.lat;

// 輸出（簡化）
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

可以看到編譯後的代碼確實比手寫 `&&` 要長一些，但可讀性在源碼層面大大提升。

## 小結

- 可選鏈 `?.` 安全地訪問深層嵌套屬性，中間層為 null/undefined 時返回 undefined
- 支持三種用法：屬性訪問 `?.prop`、數組索引 `?.[index]`、函數調用 `?.()`
- 與空值合併運算符 `??` 配合使用可以提供默認值
- TypeScript 3.7+ 原生支持，Babel 也有插件支持
- 不能用於賦值操作左側
- 不要濫用，確定存在的屬性不需要使用可選鏈
