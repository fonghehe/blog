---
title: "TypeScript 4.0 新特性與宣告檔案最佳實踐"
date: 2020-01-13 16:15:38
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 4.0 在去年 8 月釋出了，團隊從 3.7 升級到 4.0 幾乎沒有 breaking changes。這周整理了升級過程中發現的實用特性，以及我們維護宣告檔案的經驗。"
wordCount: 322
---

TypeScript 4.0 在去年 8 月釋出了，團隊從 3.7 升級到 4.0 幾乎沒有 breaking changes。這周整理了升級過程中發現的實用特性，以及我們維護宣告檔案的經驗。

## 可變引數元組型別 (Variadic Tuple Types)

這個特性對寫工具型別幫助很大。

```typescript
// 以前：處理不同型別引數組合很痛苦
type Args1 = [string, number];
type Args2 = [boolean, string];

// 4.0：用展開運算符合並元組
type CombinedArgs = [...Args1, ...Args2];
// 等價於 [string, number, boolean, string]

// 實用場景：函式型別組合
type Curried<F, R> = F extends (...args: infer A) => R
  ? (...args: A) => R
  : never;

// 更強大的：泛型元組
type PartialArgs<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? [First | undefined, ...PartialArgs<Rest>]
  : [];

type Result = PartialArgs<[string, number, boolean]>;
// [string | undefined, number | undefined, boolean | undefined]
```

**實際應用：型別安全的事件系統**

```typescript
// 我們的事件匯流排型別定義
type EventMap = {
  'user:login': [User, LoginInfo];
  'user:logout': [User];
  'order:create': [Order, PaymentInfo];
  'order:complete': [Order];
};

// 4.0 之前很難做到型別安全的 emit/on
class TypedEventEmitter<T extends Record<string, unknown[]>> {
  on<K extends keyof T>(
    event: K,
    listener: (...args: T[K]) => void
  ): void { /* ... */ }

  emit<K extends keyof T>(
    event: K,
    ...args: T[K]
  ): void { /* ... */ }
}

const bus = new TypedEventEmitter<EventMap>();

bus.on('user:login', (user, loginInfo) => {
  // user 型別自動推導為 User
  // loginInfo 型別自動推導為 LoginInfo
  console.log(user.name, loginInfo.ip);
});

bus.emit('order:create', order, payment);
// 型別檢查：引數不對就報錯
```

## 標記元組元素 (Labeled Tuple Elements)

```typescript
// 以前：元組可讀性差
function getRange(): [number, number, number, number] {
  return [10, 20, 100, 200];
}
const [a, b, c, d] = getRange();  // a b c d 是什麼含義？

// 4.0：加標籤
function getRange(): [x: number, y: number, width: number, height: number] {
  return [10, 20, 100, 200];
}
const [x, y, width, height] = getRange();  // 一目瞭然

// IDE 裡也顯示標籤名，非常好用
```

## 建構函式的類屬性推導

```typescript
// 3.x 需要手動宣告型別
class ApiClient {
  baseUrl: string;        // 必須宣告
  timeout: number;        // 必須宣告

  constructor(baseUrl: string, timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }
}

// 4.0：可以從 super() 引數推導
class BaseComponent {
  constructor(public props: Record<string, unknown>) {}
}

class MyComponent extends BaseComponent {
  // 不需要重新宣告 props，自動繼承型別
  render() {
    return this.props.title;  // 型別安全
  }
}
```

## 宣告檔案最佳實踐

我們團隊維護了一個內部元件庫，宣告檔案的寫法很重要。

### 1. 基礎元件宣告

```typescript
// types/button.d.ts
import { VNode } from 'vue';

// 用 interface 定義 props，便於擴充套件
export interface ButtonProps {
  /** 按鈕型別 */
  type?: 'primary' | 'default' | 'danger' | 'link';
  /** 按鈕大小 */
  size?: 'large' | 'medium' | 'small';
  /** 是否載入中 */
  loading?: boolean;
  /** 是否停用 */
  disabled?: boolean;
  /** 點選事件 */
  onClick?: (e: MouseEvent) => void;
}

// 匯出元件
export declare const Button: {
  new (): {
    $props: ButtonProps;
    $emit: {
      (e: 'click', event: MouseEvent): void;
    };
  };
};
```

### 2. 泛型元件宣告

```typescript
// types/table.d.ts
export interface TableColumn<T = any> {
  key: keyof T & string;
  title: string;
  width?: number | string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T, index: number) => VNode;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  rowKey: keyof T & string;
  onRowClick?: (row: T, index: number) => void;
}

// 用法：TableProps<User> 就能自動推導列的 key 型別
```

### 3. 模組宣告與路徑對映

```typescript
// types/global.d.ts
// 全域性型別擴充套件

// 擴充套件 Window 物件
declare global {
  interface Window {
    __APP_VERSION__: string;
    gtag?: (...args: any[]) => void;
  }
}

// CSS Modules 宣告
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

// 靜態資源宣告
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

// 第三方無型別庫的快速宣告
declare module 'some-untyped-lib' {
  export function doSomething(a: string, b: number): boolean;
  export const VERSION: string;
}
```

### 4. API 響應型別體系

```typescript
// types/api.d.ts

// 統一的 API 響應格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T = any> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 分頁請求的響應型別
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// 示例：使用者列表 API
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

// 在 axios 封裝中使用
export type UserListResponse = PaginatedResponse<User>;
export type UserDetailResponse = ApiResponse<User>;
```

### 5. 工具函式的型別體操

```typescript
// types/utils.d.ts

// 深度隻讀
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K];
};

// 提取元件 emit 事件名
export type EmitEventName<T> = T extends {
  $emit: infer E;
}
  ? E extends { (event: infer N, ...args: any[]): any }
    ? N
    : never
  : never;

// 可選欄位的 Required 版本
export type RequiredByKeys<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

// 用法示例
type UserInput = RequiredByKeys<User, 'name' | 'email'>;
// name 和 email 必填，其他可選
```

## tsconfig.json 設定要點

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // 4.0 相關
    "noEmit": true,                    // 隻做檢查，不輸出
    "declaration": true,               // 庫專案開啟
    "declarationDir": "./dist/types",

    // 路徑對映
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@types/*": ["types/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "types/**/*.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## 升級注意事項

```bash
# 升級步驟
npm install typescript@4.0 --save-dev

# 檢查是否有型別錯誤
npx tsc --noEmit

# 常見問題：
# 1. 4.0 對過載函式的型別檢查更嚴格
# 2. unknown 型別的使用限製更明確
# 3. 條件型別中 infer 的行為有細微變化
```

## 小結

- TypeScript 4.0 的可變引數元組型別讓複雜型別組合變得簡潔
- 標記元組元素提升了程式碼可讀性，推薦所有元組型別都加標籤
- 宣告檔案是元件庫的重要資產，良好的型別定義能顯著提升開發體驗
- API 響應型別體系要從專案初期就建立規範，避免後期到處寫 `any`
- 升級 4.0 的 breaking changes 很少，放心升級
