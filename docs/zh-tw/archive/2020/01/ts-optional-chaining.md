---
title: "TypeScript 可選鏈與空值合併實戰"
date: 2020-01-07 16:46:58
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 3.7 引入了可選鏈（Optional Chaining）和空值合併（Nullish Coalescing）這兩個語法，終於不用再寫一長串的 `&&` 判斷了。在實際專案中用了一段時間，總結一下使用場景和注意事項。"
wordCount: 235
---

TypeScript 3.7 引入了可選鏈（Optional Chaining）和空值合併（Nullish Coalescing）這兩個語法，終於不用再寫一長串的 `&&` 判斷了。在實際專案中用了一段時間，總結一下使用場景和注意事項。

## 可選鏈 ?. 解決什麼問題

日常開發中最常見的就是訪問深層巢狀物件屬性，以前得這麼寫：

```typescript
// 以前：層層判斷
const street = user && user.address && user.address.street;

// 或者用 lodash
import get from 'lodash/get';
const street = get(user, 'address.street');
```

有了可選鏈，一行搞定：

```typescript
// 可選鏈：簡潔明瞭
const street = user?.address?.street;

// 方法呼叫也可選鏈
const result = user?.getAddress?.();

// 陣列訪問
const first = arr?.[0];
```

## 空值合併 ??

和 `||` 的區別是關鍵：`||` 會把 `0`、`''`、`false` 也當作假值，`??` 只處理 `null` 和 `undefined`。

```typescript
const count = 0;

// || 的問題：0 被當成假值
console.log(count || 10);  // 10 —— 不對！

// ?? 只看 null/undefined
console.log(count ?? 10);  // 0 —— 正確

// 典型場景：API 返回的預設值
interface Config {
  pageSize: number;
  theme: string;
}

function loadConfig(input: Partial<Config>): Config {
  return {
    pageSize: input.pageSize ?? 20,
    theme: input.theme ?? 'light',
  };
}
```

## 實際專案中的應用

```typescript
// API 響應處理
interface ApiResponse {
  data?: {
    list?: Array<{
      id: number;
      name: string;
      avatar?: string;
    }>;
    total?: number;
  };
  code: number;
}

function renderUsers(res: ApiResponse) {
  const users = res.data?.list ?? [];
  const total = res.data?.total ?? 0;

  users.forEach(user => {
    // 頭像兜底
    const avatar = user.avatar ?? '/default-avatar.png';
    console.log(`${user.name}: ${avatar}`);
  });

  return { users, total };
}

// 條件執行
function notify(message: string, callback?: (msg: string) => void) {
  callback?.(message);
}

// Vue 元件中的應用（配合 TypeScript）
// computed 裡經常用
const userName = computed(() => {
  return store.state.user?.profile?.name ?? '未登入';
});
```

## 配置 TypeScript 支援

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}
```

如果目標瀏覽器不支援，Babel 會幫忙降級：

```bash
npm install @babel/plugin-proposal-optional-chaining @babel/plugin-proposal-nullish-coalescing-operator -D
```

```json
// babel.config.json
{
  "plugins": [
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator"
  ]
}
```

## 小結

- 可選鏈 `?.` 讓深層屬性訪問變得安全且簡潔
- 空值合併 `??` 比 `||` 更精確，不會誤判 `0`、`''`、`false`
- 配合 TypeScript 3.7+ 使用，型別推斷也能正確跟隨
- 注意相容性，老專案需要 Babel 外掛降級
