---
title: "TypeScript 3.x 新特性全覽"
date: 2019-01-12 16:10:42
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 3.0 到 3.3 陸續釋出，加了不少實用特性。整理一下。"
wordCount: 116
---

TypeScript 3.0 到 3.3 陸續釋出，加了不少實用特性。整理一下。

## 3.0：元組改進 + unknown 型別

```typescript
// 元組支援剩餘引數
type Strings = [string, ...string[]];
type Numbers = [number, number, ...number[]];

function tail<T extends any[]>(arr: [any, ...T]): T {
  const [, ...rest] = arr;
  return rest as T;
}

// unknown：比 any 安全的頂部型別
function process(value: unknown) {
  // 必須先做型別檢查才能使用
  if (typeof value === "string") {
    console.log(value.toUpperCase()); // ✅ 型別縮窄後才能呼叫
  }
  value.toUpperCase(); // ❌ 編譯報錯
}

// 對比 any：any 跳過型別檢查，unknown 要求驗證
function processAny(value: any) {
  value.toUpperCase(); // ✅ 不報錯，但執行時可能爆炸
}
```

## 3.1：對映型別升級

```typescript
// 對映型別現在支援元組和陣列
type Stringify<T> = { [K in keyof T]: string };

type NumbersStr = Stringify<[number, number]>;
// 等價於 [string, string]

// 函式屬性上的對映
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};
```

## 3.2：strictBindCallApply

```typescript
// 開啟後 bind/call/apply 也有型別檢查
function add(a: number, b: number): number {
  return a + b;
}

const result = add.call(null, 1, "2"); // ❌ 報錯：'2' 不是 number
const bound = add.bind(null, 1); // bound: (b: number) => number
```

## 3.3：複合賦值運算子改進

```typescript
// 聯合型別函式現在可以呼叫了
type Adder = (a: number, b: number) => number;
type Concat = (a: string, b: string) => string;

let fn: Adder | Concat;
fn(1, 2); // ✅ 3.3 之前報錯，現在可以
fn("a", "b"); // ✅
```

## 常用工具型別速查

```typescript
// 內建工具型別
type Partial<T> = { [K in keyof T]?: T[K] }; // 所有屬性可選
type Required<T> = { [K in keyof T]-?: T[K] }; // 所有屬性必填
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // 只讀
type Pick<T, K extends keyof T> = { [P in K]: T[P] }; // 挑選屬性
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>; // 排除屬性
type Record<K extends string, T> = { [P in K]: T }; // 構建物件型別
type Exclude<T, U> = T extends U ? never : T; // 排除聯合型別
type Extract<T, U> = T extends U ? T : never; // 提取聯合型別
type NonNullable<T> = T extends null | undefined ? never : T;

// ReturnType：獲取函式返回值型別
function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }
```

## 在 Vue 專案中的實踐建議

```typescript
// vue-property-decorator 結合 TS
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class UserCard extends Vue {
  @Prop({ required: true })
  userId!: number;

  @Prop({ default: "default-avatar.png" })
  avatar!: string;

  // TS 讓 Vuex action 也有型別
  async loadUser() {
    const user: User = await this.$store.dispatch("user/fetch", this.userId);
  }
}
```

## 小結

- `unknown` 替代 `any`，型別安全但需要先驗證
- `strictBindCallApply` 讓 bind/call/apply 有型別檢查
- 內建工具型別（Partial/Required/Pick/Omit）要熟練使用
- `ReturnType<typeof fn>` 很實用，避免重複定義型別
