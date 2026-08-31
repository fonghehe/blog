---
title: "TypeScript Declaration Files Writing Guide"
date: 2019-10-28 16:19:50
tags:
  - TypeScript
readingTime: 3
description: "When you pull a third-party JavaScript library into a TypeScript project, declaration files (`.d.ts`) are the bridge between the type system and untyped code. Even if the library ships no type definitions, you can write declaration files yourself. This article systematically walks through how to write them."
wordCount: 284
---

When you pull a third-party JavaScript library into a TypeScript project, declaration files (`.d.ts`) are the bridge between the type system and untyped code. Even if the library ships no type definitions, you can write declaration files yourself. This article systematically walks through how to write them.

## Purpose of Declaration Files

A declaration file (`.d.ts`) contains only type information, not implementation. The compiler uses it to understand the type structure of JavaScript code:

```ts
// index.d.ts - 声明文件
export function add(a: number, b: number): number;
export function multiply(a: number, b: number): number;

// 在 TS 文件中使用
import { add, multiply } from './math';
add(1, 2);       // 类型检查通过
add('1', '2');    // 类型错误：Argument of type 'string' is not assignable
```

## Global Declarations

For libraries pulled in via a `<script>` tag, you need global declarations:

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

## Module Declarations

For npm packages, use module declarations:

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

## Declaring Types for Internal Modules

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

## Function Overloads

Declaration files can use function overloads to express the different ways the same function can be called:

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

## Generic Declarations

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

## Hybrid Type Declarations

Some JavaScript exports are both a function and an object with properties:

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

## Using @types Community Declarations

DefinitelyTyped is a community-maintained repository of type declarations; most popular npm packages have a corresponding `@types` package:

```bash
# 安装社区类型声明
npm install --save-dev @types/lodash
npm install --save-dev @types/react
npm install --save-dev @types/node
```

If you can't find a matching type declaration, you can create a fallback:

```ts
// declarations/unknown-modules.d.ts
declare module 'some-untyped-library' {
  const lib: any;
  export default lib;
}
```

## Configuring tsconfig.json

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

## Publishing Your Own Type Declarations

If you've built an npm package, you can specify the types entry point in `package.json`:

```json
{
  "name": "my-library",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

Type declarations should be published alongside the source code rather than dropped into DefinitelyTyped.

## Summary

- A declaration file (`.d.ts`) contains only type information, never implementation code
- `declare module` declares a module's types, and `declare namespace` declares a global namespace
- Function overloads can express the different call signatures of the same function
- Generics make type declarations more flexible and precise
- File types handled by Webpack (`.png`, `.css`, etc.) need special declarations
- Use `@types/xxx` to get community-maintained type declarations
- When publishing an npm package, the `types` field in `package.json` points to the type entry
