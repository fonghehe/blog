---
title: "TypeScript 5.7–5.8: The Continuous Evolution of the Type System"
date: 2025-04-20 10:00:00
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.7 and 5.8 have been released in succession, bringing a number of practical new features. Let's go through the changes that impact day-to-day develo"
---

TypeScript 5.7 and 5.8 have been released in succession, bringing a number of practical new features. Let's go through the changes that impact day-to-day development.

## 5.7 New Features

### Relative Path Import Completion

```ts
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// 之前：手动写路径
import { Button } from "../../../components/Button";

// 5.7：IDE 自动补全相对路径，不再需要手动算层级
import { Button } from "@/components/ui/Button";
```

### `--target es2024`

```ts
// tsconfig.json
{
  "compilerOptions": {
    // 5.7 新增 es2024 target
    "target": "es2024",
    // 支持 Object.groupBy、Map.groupBy 等新 API
  }
}

// 现在可以直接用 Object.groupBy
const items = [
  { name: "apple", category: "fruit" },
  { name: "carrot", category: "vegetable" },
  { name: "banana", category: "fruit" },
];

const grouped = Object.groupBy(items, (item) => item.category);
// { fruit: [...], vegetable: [...] }
```

## 5.8 New Features

### `using` Declaration (TC39 Stage 3)

```ts
// using 声明：自动资源管理
// 离开作用域时自动调用 [Symbol.dispose]()

function processFile(path: string) {
  using file = openFile(path);
  // file 在函数结束时自动关闭

  const data = file.read();
  return data;
}

// 实际应用：数据库连接管理
class DatabaseConnection {
  [Symbol.dispose]() {
    this.disconnect();
    console.log("数据库连接已释放");
  }

  query(sql: string) {
    /* ... */
  }
  disconnect() {
    /* ... */
  }
}

async function fetchUsers() {
  using db = new DatabaseConnection();
  return db.query("SELECT * FROM users");
  // db 在这里自动 disconnect
}
```

### `await using` Declaration

```ts
// 异步资源释放
async function fetchData() {
  await using transaction = await db.beginTransaction();

  const users = await transaction.query("SELECT * FROM users");
  await transaction.query("UPDATE stats SET count = count + 1");

  return users;
  // transaction 在这里自动 commit 或 rollback
}

// 配合 AsyncDisposable
class Lock implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.release();
  }

  async acquire() {
    /* ... */
  }
  async release() {
    /* ... */
  }
}
```

### Enhanced Type Narrowing

```ts
// 5.8 的类型推断更智能

interface Success<T> {
  success: true;
  data: T;
}

interface Failure {
  success: false;
  error: string;
}

type Result<T> = Success<T> | Failure;

function handleResult<T>(result: Result<T>): T | null {
  // TS 自动识别 discriminated union
  if (result.success) {
    // result 被缩小为 Success<T>
    console.log(result.data); // 类型安全
    return result.data;
  }
  // result 被缩小为 Failure
  console.error(result.error);
  return null;
}
```

### Utility Type Improvements

```ts
// 5.8 改进了 Partial、Required 等工具类型

interface Config {
  host: string;
  port: number;
  database: {
    name: string;
    user: string;
    password: string;
  };
}

// DeepPartial（实验性）
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const partialConfig: DeepPartial<Config> = {
  database: {
    name: "mydb",
    // 只需要部分字段
  },
};
```

## Practical Applications

```ts
// 实际项目中的 using 应用

// 1. 性能测量
class PerfMeasure implements Disposable {
  private start: number;
  constructor(private label: string) {
    this.start = performance.now();
  }
  [Symbol.dispose]() {
    const duration = performance.now() - this.start;
    console.log(`[${this.label}] ${duration.toFixed(2)}ms`);
  }
}

function render() {
  using _perf = new PerfMeasure("render");
  // ... 渲染逻辑
  // 自动输出耗时
}

// 2. 事件监听器管理
class EventListener implements Disposable {
  constructor(
    private target: EventTarget,
    private event: string,
    private handler: EventListener,
  ) {
    target.addEventListener(event, handler);
  }
  [Symbol.dispose]() {
    this.target.removeEventListener(this.event, this.handler);
  }
}

// 3. 锁机制
using lock = new AsyncLock();
// 临界区操作，自动释放
```

## Summary

- TypeScript 5.7 supports `es2024` target, enabling new APIs like `Object.groupBy`
- `using` and `await using` are important resource-management features, similar to Go's `defer` and Python's `with`
- Type inference continues to improve, reducing the need for manual type annotations
- Keep your TS version up-to-date; new features make your code safer and more concise
