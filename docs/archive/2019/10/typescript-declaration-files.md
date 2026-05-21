---
title: "TypeScript 声明文件编写指南"
date: 2019-10-28 16:19:50
tags:
  - TypeScript
readingTime: 4
description: "在 TypeScript 项目中引入第三方 JavaScript 库时，声明文件（`.d.ts`）是连接类型系统和无类型代码的桥梁。即使库本身没有提供类型定义，我们也可以自己编写声明文件。本文系统地介绍声明文件的编写方法。"
wordCount: 463
---

在 TypeScript 项目中引入第三方 JavaScript 库时，声明文件（`.d.ts`）是连接类型系统和无类型代码的桥梁。即使库本身没有提供类型定义，我们也可以自己编写声明文件。本文系统地介绍声明文件的编写方法。

## 声明文件的作用

声明文件（`.d.ts`）只包含类型信息，不包含实现。编译器使用它来理解 JavaScript 代码的类型结构：

```ts
// index.d.ts - 声明文件
export function add(a: number, b: number): number;
export function multiply(a: number, b: number): number;

// 在 TS 文件中使用
import { add, multiply } from './math';
add(1, 2);       // 类型检查通过
add('1', '2');    // 类型错误：Argument of type 'string' is not assignable
```

## 全局声明

对于通过 `<script>` 标签引入的库，需要使用全局声明：

```ts
// globals.d.ts
declare const VERSION: string;
declare function require(path: string): any;

// 声明全局变量
declare const __DEV__: boolean;

// 声明全局命名空间
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    API_BASE_URL: string;
  }
}
```

## 模块声明

对于 npm 包，使用模块声明：

```ts
// declarations/lodash.d.ts
declare module 'lodash' {
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: DebounceSettings
  ): T & Cancelable;

  export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: ThrottleSettings
  ): T & Cancelable;

  export function cloneDeep<T>(value: T): T;

  export function get(
    object: any,
    path: string | string[],
    defaultValue?: any
  ): any;

  interface DebounceSettings {
    leading?: boolean;
    maxWait?: number;
    trailing?: boolean;
  }

  interface ThrottleSettings {
    leading?: boolean;
    trailing?: boolean;
  }

  interface Cancelable {
    cancel(): void;
    flush(): void;
  }
}
```

## 为项目内部模块声明类型

```ts
// declarations/images.d.ts
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  import React from 'react';
  const SVG: React.FC<React.SVGProps<SVGSVGElement>>;
  export default SVG;
}

// declarations/styles.d.ts
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// declarations/env.d.ts
declare module '*.md' {
  const content: string;
  export default content;
}
```

## 函数重载

声明文件中可以使用函数重载来表达同一个函数的不同调用方式：

```ts
declare function ajax(url: string): Promise<string>;
declare function ajax(url: string, options: { method: 'GET' }): Promise<string>;
declare function ajax(
  url: string,
  options: { method: 'POST'; body: string }
): Promise<object>;
declare function ajax(url: string, options?: AjaxOptions): Promise<any>;

interface AjaxOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
  headers?: Record<string, string>;
}
```

## 泛型声明

```ts
declare module 'react-query' {
  export function useQuery<TData, TError = Error>(
    queryKey: string | [string, ...any[]],
    queryFn: () => Promise<TData>,
    options?: QueryOptions<TData, TError>
  ): QueryResult<TData, TError>;

  export function useMutation<TData, TVariables, TError = Error>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptions<TData, TVariables, TError>
  ): MutationResult<TData, TVariables, TError>;

  interface QueryOptions<TData, TError> {
    enabled?: boolean;
    retry?: boolean | number;
    staleTime?: number;
    cacheTime?: number;
    onSuccess?: (data: TData) => void;
    onError?: (error: TError) => void;
  }

  interface QueryResult<TData, TError> {
    data: TData | undefined;
    error: TError | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => void;
  }

  interface MutationOptions<TData, TVariables, TError> {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: TError, variables: TVariables) => void;
  }

  interface MutationResult<TData, TVariables, TError> {
    mutate: (variables: TVariables) => void;
    data: TData | undefined;
    error: TError | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
  }
}
```

## 混合类型声明

有些 JavaScript 导出既是函数，又有属性：

```ts
// axios 既有默认导出函数，又有 axios.get 等方法
declare module 'axios' {
  interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
    (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    interceptors: {
      request: AxiosInterceptorManager<AxiosRequestConfig>;
      response: AxiosInterceptorManager<AxiosResponse>;
    };
  }

  interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    params?: any;
    data?: any;
    timeout?: number;
  }

  interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: AxiosRequestConfig;
  }

  interface AxiosInterceptorManager<T> {
    use(
      onFulfilled?: (value: T) => T | Promise<T>,
      onRejected?: (error: any) => any
    ): number;
    eject(id: number): void;
  }

  const axios: AxiosInstance;
  export default axios;
}
```

## 使用 @types 社区声明

DefinitelyTyped 是社区维护的类型声明仓库，大部分流行的 npm 包都有对应的 `@types` 包：

```bash
# 安装社区类型声明
npm install --save-dev @types/lodash
npm install --save-dev @types/react
npm install --save-dev @types/node
```

如果找不到对应的类型声明，可以创建一个 fallback：

```ts
// declarations/unknown-modules.d.ts
declare module 'some-untyped-library' {
  const lib: any;
  export default lib;
}
```

## 配置 tsconfig.json

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "./dist/types",
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": [
    "src/**/*",
    "src/types/**/*"
  ]
}
```

## 发布自己的类型声明

如果开发了一个 npm 包，可以在 `package.json` 中指定类型入口：

```json
{
  "name": "my-library",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

类型声明应该与源码一起发布，而不是放到 DefinitelyTyped。

## 小结

- 声明文件（`.d.ts`）只包含类型信息，不包含实现代码
- `declare module` 用于声明模块类型，`declare namespace` 用于声明全局命名空间
- 函数重载可以表达同一个函数的不同调用签名
- 泛型可以让类型声明更加灵活和精确
- Webpack 中的文件类型（`.png`、`.css` 等）需要特殊声明
- 使用 `@types/xxx` 可以获取社区维护的类型声明
- 发布 npm 包时，`package.json` 的 `types` 字段指向类型入口
