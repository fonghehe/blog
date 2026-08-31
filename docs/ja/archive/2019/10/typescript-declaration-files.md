---
title: "TypeScript型宣言ファイル作成ガイド"
date: 2019-10-28 16:19:50
tags:
  - TypeScript
readingTime: 4
description: "在 TypeScript 项目中引入第三方 JavaScript 库时，声明文件（`.d.ts`）是连接类型系统和无类型代码的桥梁。即使库本身没有提供类型定义，我们也可以自己编写声明文件。本文系统地介绍声明文件的编写方法。"
wordCount: 734
---

TypeScript プロジェクトにサードパーティの JavaScript ライブラリを導入する際、宣言ファイル（`.d.ts`）は型システムと型なしコードをつなぐ架け橋となります。ライブラリ自体が型定義を提供していなくても、自分で宣言ファイルを書けます。本記事では宣言ファイルの書き方を体系的に紹介します。

## 型宣言ファイルの役割

宣言ファイル（`.d.ts`）は型情報だけを含み、実装は含みません。コンパイラはこれを使って JavaScript コードの型構造を理解します：

```ts
// index.d.ts - 声明文件
export function add(a: number, b: number): number;
export function multiply(a: number, b: number): number;

// 在 TS 文件中使用
import { add, multiply } from './math';
add(1, 2);       // 类型检查通过
add('1', '2');    // 类型错误：Argument of type 'string' is not assignable
```

## グローバル宣言

`<script>` タグ経由で読み込むライブラリには、グローバル宣言が必要です：

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

## モジュール宣言

npm パッケージには、モジュール宣言を使います：

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

## 内部モジュールの型宣言

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

## 関数オーバーロード

宣言ファイルでは、関数オーバーロードを使って同じ関数の異なる呼び出し方を表現できます：

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

## ジェネリクス宣言

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

## ハイブリッド型宣言

関数でもあり、かつプロパティも持つ JavaScript のエクスポートもあります：

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

## @typesコミュニティ宣言の使用

DefinitelyTyped はコミュニティが保守する型宣言リポジトリであり、人気のある npm パッケージの多くに相当する `@types` パッケージがあります：

```bash
# 安装社区类型声明
npm install --save-dev @types/lodash
npm install --save-dev @types/react
npm install --save-dev @types/node
```

対応する型宣言が見つからない場合は、フォールバックを作成できます：

```ts
// declarations/unknown-modules.d.ts
declare module 'some-untyped-library' {
  const lib: any;
  export default lib;
}
```

## tsconfig.jsonの設定

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

## 自分の型宣言を公開する

npm パッケージを開発する場合、`package.json` で型のエントリを指定できます：

```json
{
  "name": "my-library",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

型宣言はソースコードと一緒に公開し、DefinitelyTyped には置かないようにします。

## まとめ

- 宣言ファイル（`.d.ts`）は型情報だけを含み、実装コードは含みません
- `declare module` はモジュール型の宣言に、`declare namespace` はグローバル名前空間の宣言に使います
- 関数オーバーロードは同じ関数の異なる呼び出しシグネチャを表現できます
- ジェネリクスにより、型宣言をより柔軟かつ正確にできます
- Webpack のファイル型（`.png`、`.css` など）には特別な宣言が必要です
- `@types/xxx` を使うとコミュニティ保守の型宣言を取得できます
- npm パッケージを公開する際、`package.json` の `types` フィールドは型のエントリを指します
