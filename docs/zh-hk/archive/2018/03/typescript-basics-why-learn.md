---
title: "TypeScript 基礎：為什麼現在開始學"
date: 2018-03-03 17:32:01
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 不是新技術了（2012 年微軟發佈），但 2017-2018 年才真正在國內前端圈流行起來。Angular 2+ 強制使用，Vue 2.5 也改善了 TS 支持，是時候認真學一下了。"
---

TypeScript 不是新技術了（2012 年微軟發佈），但 2017-2018 年才真正在國內前端圈流行起來。Angular 2+ 強制使用，Vue 2.5 也改善了 TS 支持，是時候認真學一下了。

## 為什麼用 TypeScript

JavaScript 的類型問題往往在運行時才暴露：

```javascript
function add(a, b) {
  return a + b;
}

add(1, 2); // 3，正確
add("1", 2); // '12'，字符串拼接，可能是 bug
add(null, 2); // 2，null 被當作 0，可能意外
```

TypeScript 在編譯時就能發現這類問題：

```typescript
function add(a: number, b: number): number {
  return a + b;
}

add("1", 2); // ❌ 編譯錯誤：Argument of type 'string' is not assignable to parameter of type 'number'
```

## 基礎類型

```typescript
// 原始類型
let name: string = "Alice";
let age: number = 25;
let isActive: boolean = true;

// 數組
let nums: number[] = [1, 2, 3];
let strs: Array<string> = ["a", "b"];

// 元組（長度和類型都固定）
let pair: [string, number] = ["Alice", 25];

// 枚舉
enum Direction {
  Up,
  Down,
  Left,
  Right,
}
let dir: Direction = Direction.Up; // 值是 0

// any（逃生艙，儘量少用）
let anything: any = "hello";
anything = 42; // 不報錯

// void（函數沒有返回值）
function log(msg: string): void {
  console.log(msg);
}

// null 和 undefined
let n: null = null;
let u: undefined = undefined;
```

## 接口（Interface）

描述對象的形狀：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // 可選屬性
  readonly token: string; // 只讀屬性
}

function createUser(user: User): void {
  console.log(user.name);
  // user.token = 'new'  // ❌ 只讀，不能修改
}

createUser({
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  token: "abc123",
});
```

接口也可以描述函數：

```typescript
interface SearchFunc {
  (query: string, limit: number): Promise<string[]>;
}

const search: SearchFunc = async (query, limit) => {
  // 實現...
  return [];
};
```

## 類型別名（Type Alias）

```typescript
type ID = string | number;
type Status = "active" | "inactive" | "pending";

let userId: ID = 123;
userId = "user-456"; // 也合法

let status: Status = "active";
status = "deleted"; // ❌ 不在聯合類型裏
```

## 泛型

讓函數/類/接口適用於多種類型：

```typescript
// 沒有泛型：只能用 any，失去類型檢查
function first(arr: any[]): any {
  return arr[0];
}

// 有了泛型：類型安全
function first<T>(arr: T[]): T {
  return arr[0];
}

const num = first([1, 2, 3]); // 類型推斷：num 是 number
const str = first(["a", "b"]); // str 是 string
```

## 在 Vue 2.5+ 中使用 TypeScript

### 方式一：vue-class-component（裝飾器風格）

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

### 方式二：Vue.extend（更接近標準 Options API）

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

## tsconfig.json 基礎配置

```json
{
  "compilerOptions": {
    "target": "es5", // 編譯到 ES5
    "module": "commonjs",
    "strict": true, // 開啓所有嚴格檢查（推薦）
    "esModuleInterop": true, // 允許 import xxx from 'xxx' 風格
    "sourceMap": true, // 生成 source map
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"] // 路徑別名
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## 漸進式遷移策略

不必一次性把所有 JS 改成 TS，可以漸進式遷移：

1. 先把 `tsconfig.json` 的 `allowJs: true` 開啓，JS 和 TS 文件混用
2. 新文件用 `.ts` 寫
3. 逐步把重要的舊文件改成 `.ts`
4. 最後把 `allowJs: false`

## 小結

TypeScript 的核心價值是**在寫代碼時就能發現類型錯誤**，而不是運行時。對於中大型項目，這個收益非常明顯。入門門檻不高，從接口和基礎類型開始，遇到問題再查文檔。
