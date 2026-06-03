---
title: "TypeScript 7.2 新特性：模板字面量類型的進階用法"
date: 2026-06-03 14:06:50
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 7.2 的模板字面量類型得到了顯著增強。本文深入探討類型推斷、字符串操作和實際應用場景，幫助你在大型項目中更好地利用類型系統。"
wordCount: 509
---

TypeScript 的模板字面量類型從 4.1 引入至今，已經成為類型體操的核心能力之一。7.2 版本在此基礎上增加了更強大的推斷能力和內建字符串操作工具，讓複雜的字符串類型推斷變得更加直觀。

## 基礎回顧與 7.2 增強

模板字面量類型的核心是 `${T}` 語法，它允許將字符串字面量類型嵌入模板中：

```typescript
type EventName = 'click' | 'focus' | 'blur'
type HandlerName = `on${Capitalize<EventName>}`
// 'onClick' | 'onFocus' | 'onBlur'
```

7.2 新增了 `Uncapitalize<T>` 工具類型，與 `Capitalize` 形成對稱：

```typescript
type MethodName = 'getUserData' | 'setUserData'
type RawName = Uncapitalize<MethodName>
// 'getUserData' | 'setUserData' — 已經是小寫開頭
```

## 類型推斷的進階模式

7.2 最重要的改進是模板字面量推斷能力的增強。現在可以在更複雜的模式中提取子字符串：

```typescript
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never

type Params = ExtractRouteParams<'/users/:id/posts/:postId'>
// 'id' | 'postId'
```

## 實際應用場景

### API 路徑類型安全

在大型項目中，類型安全的 API 路徑可以顯著減少運行時錯誤：

```typescript
type ApiVersion = 'v1' | 'v2' | 'v3'
type Resource = 'users' | 'posts' | 'comments'
type Action = 'list' | 'create' | 'update' | 'delete'

type ApiPath = `/${ApiVersion}/${Resource}/${Action}`

function apiCall<T extends ApiPath>(path: T): Promise<Response> {
  return fetch(`/api${path}`)
}
```

### CSS 變數類型推斷

結合 CSS 自訂屬性，可以實現主題變數的類型安全：

```typescript
type ThemeToken = 'primary' | 'secondary' | 'accent' | 'background' | 'text'
type TokenShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
type CssVariable = `--color-${ThemeToken}-${TokenShade}`
```

## 遞迴模板字面量類型

7.2 優化了遞迴模板字面量類型的性能，讓深層嵌套的類型推斷更加高效：

```typescript
type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}`
    ? [Head, ...Split<Tail, D>]
    : [S]

type Result = Split<'a.b.c.d', '.'>
// ['a', 'b', 'c', 'd']
```

## 與條件類型的配合

模板字面量類型與條件類型的配合可以實現複雜的類型轉換：

```typescript
type Camelize<T extends string> =
  T extends `${infer Head}_${infer Tail}`
    ? `${Head}${Camelize<Capitalize<Tail>>}`
    : T

type Result1 = Camelize<'user_name'>  // 'userName'
type Result2 = Camelize<'get_user_data'>  // 'getUserData'

// 批量轉換對象鍵名
type CamelizeKeys<T extends Record<string, any>> = {
  [K in keyof T as Camelize<K & string>]: T[K]
}
```

## 性能注意事項

1. **避免過深的遞迴**：超過 10 層的遞迴模板字面量類型可能導致編譯時間顯著增加
2. **合理使用 `never` 短路**：在遞迴類型中提前返回 `never` 可以避免無效計算
3. **緩存複雜類型**：將頻繁使用的複雜類型提取為獨立的類型別名

## 總結

TypeScript 7.2 的模板字面量類型增強讓字符串操作的類型推斷更加強大和直觀。從 API 路徑類型安全到 CSS 變數推斷，從路由參數解析到對象鍵名轉換，這些能力在大型項目中能顯著提升開發體驗和代碼可靠性。
