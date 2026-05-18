---
title: "TypeScript 宣告檔案編寫指南"
date: 2019-10-28 16:19:50
tags:
  - TypeScript
readingTime: 4
description: "在 TypeScript 專案中引入第三方 JavaScript 庫時，宣告檔案（`.d.ts`）是連線型別系統和無型別程式碼的橋樑。即使庫本身沒有提供型別定義，我們也可以自己編寫宣告檔案。本文系統地介紹宣告檔案的編寫方法。"
---

在 TypeScript 專案中引入第三方 JavaScript 庫時，宣告檔案（`.d.ts`）是連線型別系統和無型別程式碼的橋樑。即使庫本身沒有提供型別定義，我們也可以自己編寫宣告檔案。本文系統地介紹宣告檔案的編寫方法。

## 宣告檔案的作用

宣告檔案（`.d.ts`）只包含型別資訊，不包含實現。編譯器使用它來理解 JavaScript 程式碼的型別結構：

```ts
// index.d.ts - 宣告檔案
export function add(a: number, b: number): number;
export function multiply(a: number, b: number): number;

// 在 TS 檔案中使用
import { add, multiply } from './math';
add(1, 2);       // 型別檢查通過
add('1', '2');    // 型別錯誤：Argument of type 'string' is not assignable
```

## 全域性宣告

對於通過 `<script>` 標籤引入的庫，需要使用全域性宣告：

```ts
// globals.d.ts
declare const VERSION: string;
declare function require(path: string): any;

// 宣告全域性變數
declare const __DEV__: boolean;

// 宣告全域性名稱空間
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    API_BASE_URL: string;
  }
}
```

## 模組宣告

對於 npm 包，使用模組宣告：

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

## 為專案內部模組宣告型別

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

## 函式過載

宣告檔案中可以使用函式過載來表達同一個函式的不同調用方式：

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

## 泛型宣告

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

## 混合型別宣告

有些 JavaScript 匯出既是函式，又有屬性：

```ts
// axios 既有預設匯出函式，又有 axios.get 等方法
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

## 使用 @types 社群宣告

DefinitelyTyped 是社群維護的型別宣告倉庫，大部分流行的 npm 包都有對應的 `@types` 包：

```bash
# 安裝社群型別宣告
npm install --save-dev @types/lodash
npm install --save-dev @types/react
npm install --save-dev @types/node
```

如果找不到對應的型別宣告，可以建立一個 fallback：

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

## 釋出自己的型別宣告

如果開發了一個 npm 包，可以在 `package.json` 中指定型別入口：

```json
{
  "name": "my-library",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

型別宣告應該與原始碼一起釋出，而不是放到 DefinitelyTyped。

## 小結

- 宣告檔案（`.d.ts`）只包含型別資訊，不包含實現程式碼
- `declare module` 用於宣告模組型別，`declare namespace` 用於宣告全域性名稱空間
- 函式過載可以表達同一個函式的不同調用簽名
- 泛型可以讓型別宣告更加靈活和精確
- Webpack 中的檔案型別（`.png`、`.css` 等）需要特殊宣告
- 使用 `@types/xxx` 可以獲取社群維護的型別宣告
- 釋出 npm 包時，`package.json` 的 `types` 欄位指向型別入口
