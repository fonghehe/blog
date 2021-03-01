---
title: "TypeScript 3.x 新特性全览"
date: 2019-01-12 16:10:42
tags:
  - TypeScript
---

TypeScript 3.0 到 3.3 陆续发布，加了不少实用特性。整理一下。

## 3.0：元组改进 + unknown 类型

```typescript
// 元组支持剩余参数
type Strings = [string, ...string[]];
type Numbers = [number, number, ...number[]];

function tail<T extends any[]>(arr: [any, ...T]): T {
  const [, ...rest] = arr;
  return rest as T;
}

// unknown：比 any 安全的顶部类型
function process(value: unknown) {
  // 必须先做类型检查才能使用
  if (typeof value === "string") {
    console.log(value.toUpperCase()); // ✅ 类型缩窄后才能调用
  }
  value.toUpperCase(); // ❌ 编译报错
}

// 对比 any：any 跳过类型检查，unknown 要求验证
function processAny(value: any) {
  value.toUpperCase(); // ✅ 不报错，但运行时可能爆炸
}
```

## 3.1：映射类型升级

```typescript
// 映射类型现在支持元组和数组
type Stringify<T> = { [K in keyof T]: string };

type NumbersStr = Stringify<[number, number]>;
// 等价于 [string, string]

// 函数属性上的映射
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};
```

## 3.2：strictBindCallApply

```typescript
// 开启后 bind/call/apply 也有类型检查
function add(a: number, b: number): number {
  return a + b;
}

const result = add.call(null, 1, "2"); // ❌ 报错：'2' 不是 number
const bound = add.bind(null, 1); // bound: (b: number) => number
```

## 3.3：复合赋值运算符改进

```typescript
// 联合类型函数现在可以调用了
type Adder = (a: number, b: number) => number;
type Concat = (a: string, b: string) => string;

let fn: Adder | Concat;
fn(1, 2); // ✅ 3.3 之前报错，现在可以
fn("a", "b"); // ✅
```

## 常用工具类型速查

```typescript
// 内置工具类型
type Partial<T> = { [K in keyof T]?: T[K] }; // 所有属性可选
type Required<T> = { [K in keyof T]-?: T[K] }; // 所有属性必填
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // 只读
type Pick<T, K extends keyof T> = { [P in K]: T[P] }; // 挑选属性
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>; // 排除属性
type Record<K extends string, T> = { [P in K]: T }; // 构建对象类型
type Exclude<T, U> = T extends U ? never : T; // 排除联合类型
type Extract<T, U> = T extends U ? T : never; // 提取联合类型
type NonNullable<T> = T extends null | undefined ? never : T;

// ReturnType：获取函数返回值类型
function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }
```

## 在 Vue 项目中的实践建议

```typescript
// vue-property-decorator 结合 TS
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class UserCard extends Vue {
  @Prop({ required: true })
  userId!: number;

  @Prop({ default: "default-avatar.png" })
  avatar!: string;

  // TS 让 Vuex action 也有类型
  async loadUser() {
    const user: User = await this.$store.dispatch("user/fetch", this.userId);
  }
}
```

## 小结

- `unknown` 替代 `any`，类型安全但需要先验证
- `strictBindCallApply` 让 bind/call/apply 有类型检查
- 内置工具类型（Partial/Required/Pick/Omit）要熟练使用
- `ReturnType<typeof fn>` 很实用，避免重复定义类型
