---
title: "TypeScript 4.0 の新機能と型宣言ファイルのベストプラクティス"
date: 2020-01-13 16:15:38
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 4.0 在去年 8 月发布了，团队从 3.7 升级到 4.0 几乎没有 breaking changes。这周整理了升级过程中发现的实用特性，以及我们维护声明文件的经验。"
wordCount: 329
---

TypeScript 4.0 在去年 8 月发布了，团队从 3.7 升级到 4.0 几乎没有 breaking changes。这周整理了升级过程中发现的实用特性，以及我们维护声明文件的经验。

## 可変長タプル型

这个特性对写工具类型帮助很大。

```typescript
// 以前：处理不同类型参数组合很痛苦
type Args1 = [string, number];
type Args2 = [boolean, string];

// 4.0：用展开运算符合并元组
type CombinedArgs = [...Args1, ...Args2];
// 等价于 [string, number, boolean, string]

// 实用场景：函数类型组合
type Curried<F, R> = F extends (...args: infer A) => R
  ? (...args: A) => R
  : never;

// 更强大的：泛型元组
type PartialArgs<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? [First | undefined, ...PartialArgs<Rest>]
  : [];

type Result = PartialArgs<[string, number, boolean]>;
// [string | undefined, number | undefined, boolean | undefined]
```

**实际应用：类型安全的事件系统**

```typescript
// 我们的事件总线类型定义
type EventMap = {
  'user:login': [User, LoginInfo];
  'user:logout': [User];
  'order:create': [Order, PaymentInfo];
  'order:complete': [Order];
};

// 4.0 之前很难做到类型安全的 emit/on
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
  // user 类型自动推导为 User
  // loginInfo 类型自动推导为 LoginInfo
  console.log(user.name, loginInfo.ip);
});

bus.emit('order:create', order, payment);
// 类型检查：参数不对就报错
```

## ラベル付きタプル要素

```typescript
// 以前：元组可读性差
function getRange(): [number, number, number, number] {
  return [10, 20, 100, 200];
}
const [a, b, c, d] = getRange();  // a b c d 是什么含义？

// 4.0：加标签
function getRange(): [x: number, y: number, width: number, height: number] {
  return [10, 20, 100, 200];
}
const [x, y, width, height] = getRange();  // 一目了然

// IDE 里也显示标签名，非常好用
```

## コンストラクタからのクラスプロパティ推論

```typescript
// 3.x 需要手动声明类型
class ApiClient {
  baseUrl: string;        // 必须声明
  timeout: number;        // 必须声明

  constructor(baseUrl: string, timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }
}

// 4.0：可以从 super() 参数推导
class BaseComponent {
  constructor(public props: Record<string, unknown>) {}
}

class MyComponent extends BaseComponent {
  // 不需要重新声明 props，自动继承类型
  render() {
    return this.props.title;  // 类型安全
  }
}
```

## 声明文件最佳实践

我们团队维护了一个内部组件库，声明文件的写法很重要。

### 1. 基础组件声明

```typescript
// types/button.d.ts
import { VNode } from 'vue';

// 用 interface 定义 props，便于扩展
export interface ButtonProps {
  /** 按钮类型 */
  type?: 'primary' | 'default' | 'danger' | 'link';
  /** 按钮大小 */
  size?: 'large' | 'medium' | 'small';
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击事件 */
  onClick?: (e: MouseEvent) => void;
}

// 导出组件
export declare const Button: {
  new (): {
    $props: ButtonProps;
    $emit: {
      (e: 'click', event: MouseEvent): void;
    };
  };
};
```

### 2. 泛型组件声明

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

// 用法：TableProps<User> 就能自动推导列的 key 类型
```

### 3. 模块声明与路径映射

```typescript
// types/global.d.ts
// 全局类型扩展

// 扩展 Window 对象
declare global {
  interface Window {
    __APP_VERSION__: string;
    gtag?: (...args: any[]) => void;
  }
}

// CSS Modules 声明
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

// 静态资源声明
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

// 第三方无类型库的快速声明
declare module 'some-untyped-lib' {
  export function doSomething(a: string, b: number): boolean;
  export const VERSION: string;
}
```

### 4. API 响应类型体系

```typescript
// types/api.d.ts

// 统一的 API 响应格式
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

// 分页请求的响应类型
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// 示例：用户列表 API
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

// 在 axios 封装中使用
export type UserListResponse = PaginatedResponse<User>;
export type UserDetailResponse = ApiResponse<User>;
```

### 5. 工具函数的类型体操

```typescript
// types/utils.d.ts

// 深度只读
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K];
};

// 提取组件 emit 事件名
export type EmitEventName<T> = T extends {
  $emit: infer E;
}
  ? E extends { (event: infer N, ...args: any[]): any }
    ? N
    : never
  : never;

// 可选字段的 Required 版本
export type RequiredByKeys<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

// 用法示例
type UserInput = RequiredByKeys<User, 'name' | 'email'>;
// name 和 email 必填，其他可选
```

## tsconfig.json 配置要点

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

    // 4.0 相关
    "noEmit": true,                    // 只做检查，不输出
    "declaration": true,               // 库项目开启
    "declarationDir": "./dist/types",

    // 路径映射
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

## 升级注意事项

```bash
# アップグレード手順
npm install typescript@4.0 --save-dev

# 检查是否有类型错误
npx tsc --noEmit

# 常见问题：
# 1. 4.0 对重载函数的类型检查更严格
# 2. unknown 类型的使用限制更明确
# 3. 条件类型中 infer 的行为有细微变化
```

## まとめ

- TypeScript 4.0 的可变参数元组类型让复杂类型组合变得简洁
- 标记元组元素提升了代码可读性，推荐所有元组类型都加标签
- 声明文件是组件库的重要资产，良好的类型定义能显著提升开发体验
- API 响应类型体系要从项目初期就建立规范，避免后期到处写 `any`
- 升级 4.0 的 breaking changes 很少，放心升级
