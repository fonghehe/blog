---
title: "TypeScript 基础：为什么现在开始学"
date: 2018-03-03 17:32:01
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 不是新技术了（2012 年微软发布），但 2017-2018 年才真正在国内前端圈流行起来。Angular 2+ 强制使用，Vue 2.5 也改善了 TS 支持，是时候认真学一下了。"
wordCount: 305
---

TypeScript 不是新技术了（2012 年微软发布），但 2017-2018 年才真正在国内前端圈流行起来。Angular 2+ 强制使用，Vue 2.5 也改善了 TS 支持，是时候认真学一下了。

## 为什么用 TypeScript

JavaScript 的类型问题往往在运行时才暴露：

```javascript
function add(a, b) {
  return a + b;
}

add(1, 2); // 3，正确
add("1", 2); // '12'，字符串拼接，可能是 bug
add(null, 2); // 2，null 被当作 0，可能意外
```

TypeScript 在编译时就能发现这类问题：

```typescript
function add(a: number, b: number): number {
  return a + b;
}

add("1", 2); // ❌ 编译错误：Argument of type 'string' is not assignable to parameter of type 'number'
```

## 基础类型

```typescript
// 原始类型
let name: string = "Alice";
let age: number = 25;
let isActive: boolean = true;

// 数组
let nums: number[] = [1, 2, 3];
let strs: Array<string> = ["a", "b"];

// 元组（长度和类型都固定）
let pair: [string, number] = ["Alice", 25];

// 枚举
enum Direction {
  Up,
  Down,
  Left,
  Right,
}
let dir: Direction = Direction.Up; // 值是 0

// any（逃生舱，尽量少用）
let anything: any = "hello";
anything = 42; // 不报错

// void（函数没有返回值）
function log(msg: string): void {
  console.log(msg);
}

// null 和 undefined
let n: null = null;
let u: undefined = undefined;
```

## 接口（Interface）

描述对象的形状：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // 可选属性
  readonly token: string; // 只读属性
}

function createUser(user: User): void {
  console.log(user.name);
  // user.token = 'new'  // ❌ 只读，不能修改
}

createUser({
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  token: "abc123",
});
```

接口也可以描述函数：

```typescript
interface SearchFunc {
  (query: string, limit: number): Promise<string[]>;
}

const search: SearchFunc = async (query, limit) => {
  // 实现...
  return [];
};
```

## 类型别名（Type Alias）

```typescript
type ID = string | number;
type Status = "active" | "inactive" | "pending";

let userId: ID = 123;
userId = "user-456"; // 也合法

let status: Status = "active";
status = "deleted"; // ❌ 不在联合类型里
```

## 泛型

让函数/类/接口适用于多种类型：

```typescript
// 没有泛型：只能用 any，失去类型检查
function first(arr: any[]): any {
  return arr[0];
}

// 有了泛型：类型安全
function first<T>(arr: T[]): T {
  return arr[0];
}

const num = first([1, 2, 3]); // 类型推断：num 是 number
const str = first(["a", "b"]); // str 是 string
```

## 在 Vue 2.5+ 中使用 TypeScript

### 方式一：vue-class-component（装饰器风格）

```typescript
{% raw %}
import Vue from "vue";
import Component from "vue-class-component";

@Component({
  template: '<button @click="onClick">{{ count }}</button>',
})
class Counter extends Vue {
  count: number = 0;

  onClick() {
    this.count++;
  }
}
{% endraw %}
```

### 方式二：Vue.extend（更接近标准 Options API）

```typescript
import Vue from "vue";

export default Vue.extend({
  data() {
    return {
      count: 0 as number,
      user: null as User | null,
    };
  },
  methods: {
    increment(): void {
      this.count++;
    },
    async fetchUser(id: number): Promise<void> {
      this.user = await api.getUser(id);
    },
  },
});
```

## tsconfig.json 基础配置

```json
{
  "compilerOptions": {
    "target": "es5", // 编译到 ES5
    "module": "commonjs",
    "strict": true, // 开启所有严格检查（推荐）
    "esModuleInterop": true, // 允许 import xxx from 'xxx' 风格
    "sourceMap": true, // 生成 source map
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"] // 路径别名
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## 渐进式迁移策略

不必一次性把所有 JS 改成 TS，可以渐进式迁移：

1. 先把 `tsconfig.json` 的 `allowJs: true` 开启，JS 和 TS 文件混用
2. 新文件用 `.ts` 写
3. 逐步把重要的旧文件改成 `.ts`
4. 最后把 `allowJs: false`

## 小结

TypeScript 的核心价值是**在写代码时就能发现类型错误**，而不是运行时。对于中大型项目，这个收益非常明显。入门门槛不高，从接口和基础类型开始，遇到问题再查文档。
