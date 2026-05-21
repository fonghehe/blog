---
title: "TypeScript 3.x New Features Overview"
date: 2019-01-12 16:10:42
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 3.0 through 3.3 released one after another, adding many practical features. Here's a summary."
wordCount: 43
---

TypeScript 3.0 through 3.3 released one after another, adding many practical features. Here's a summary.

## 3.0: Tuple Improvements + the `unknown` Type

```typescript
// Tuples now support rest parameters
type Strings = [string, ...string[]];
type Numbers = [number, number, ...number[]];

function tail<T extends any[]>(arr: [any, ...T]): T {
  const [, ...rest] = arr;
  return rest as T;
}

// unknown: a safer top type than any
function process(value: unknown) {
  // Must perform a type check before using
  if (typeof value === "string") {
    console.log(value.toUpperCase()); // ✅ safe after type narrowing
  }
  value.toUpperCase(); // ❌ compile error
}

// Compared to any: any skips type checking; unknown requires verification
function processAny(value: any) {
  value.toUpperCase(); // ✅ no error, but may blow up at runtime
}
```

## 3.1: Mapped Type Upgrades

```typescript
// Mapped types now support tuples and arrays
type Stringify<T> = { [K in keyof T]: string };

type NumbersStr = Stringify<[number, number]>;
// equivalent to [string, string]

// Mapping on function properties
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};
```

## 3.2: strictBindCallApply

```typescript
// With this enabled, bind/call/apply also have type checks
function add(a: number, b: number): number {
  return a + b;
}

const result = add.call(null, 1, "2"); // ❌ error: '2' is not a number
const bound = add.bind(null, 1); // bound: (b: number) => number
```

## 3.3: Compound Assignment Operator Improvements

```typescript
// Union type functions can now be called
type Adder = (a: number, b: number) => number;
type Concat = (a: string, b: string) => string;

let fn: Adder | Concat;
fn(1, 2); // ✅ used to error before 3.3, now works
fn("a", "b"); // ✅
```

## Utility Types Quick Reference

```typescript
// Built-in utility types
type Partial<T> = { [K in keyof T]?: T[K] }; // all properties optional
type Required<T> = { [K in keyof T]-?: T[K] }; // all properties required
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // read-only
type Pick<T, K extends keyof T> = { [P in K]: T[P] }; // pick properties
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>; // exclude properties
type Record<K extends string, T> = { [P in K]: T }; // construct object type
type Exclude<T, U> = T extends U ? never : T; // exclude from union type
type Extract<T, U> = T extends U ? T : never; // extract from union type
type NonNullable<T> = T extends null | undefined ? never : T;

// ReturnType: get the return type of a function
function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }
```

## Practical Recommendations for Vue Projects

```typescript
// Combining vue-property-decorator with TS
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class UserCard extends Vue {
  @Prop({ required: true })
  userId!: number;

  @Prop({ default: "default-avatar.png" })
  avatar!: string;

  // TS gives Vuex actions type safety too
  async loadUser() {
    const user: User = await this.$store.dispatch("user/fetch", this.userId);
  }
}
```

## Summary
