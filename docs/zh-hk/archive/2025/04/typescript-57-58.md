---
title: "TypeScript 5.7-5.8：類型系統的持續進化"
date: 2025-04-20 10:00:00
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.7 和 5.8 相繼發佈，帶來了一些實用的新特性。來整理一下對日常開發有影響的變化。"
wordCount: 161
---

TypeScript 5.7 和 5.8 相繼發佈，帶來了一些實用的新特性。來整理一下對日常開發有影響的變化。

## 5.7 新特性

### 相對路徑導入補全

```ts
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// 之前：手動寫路徑
import { Button } from "../../../components/Button";

// 5.7：IDE 自動補全相對路徑，不再需要手動算層級
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

// 現在可以直接用 Object.groupBy
const items = [
  { name: "apple", category: "fruit" },
  { name: "carrot", category: "vegetable" },
  { name: "banana", category: "fruit" },
];

const grouped = Object.groupBy(items, (item) => item.category);
// { fruit: [...], vegetable: [...] }
```

## 5.8 新特性

### `using` 聲明（TC39 Stage 3）

```ts
// using 聲明：自動資源管理
// 離開作用域時自動調用 [Symbol.dispose]()

function processFile(path: string) {
  using file = openFile(path);
  // file 在函數結束時自動關閉

  const data = file.read();
  return data;
}

// 實際應用：數據庫連接管理
class DatabaseConnection {
  [Symbol.dispose]() {
    this.disconnect();
    console.log("數據庫連接已釋放");
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
  // db 在這裏自動 disconnect
}
```

### `await using` 聲明

```ts
// 異步資源釋放
async function fetchData() {
  await using transaction = await db.beginTransaction();

  const users = await transaction.query("SELECT * FROM users");
  await transaction.query("UPDATE stats SET count = count + 1");

  return users;
  // transaction 在這裏自動 commit 或 rollback
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

### 增強的類型縮小

```ts
// 5.8 的類型推斷更智能

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
  // TS 自動識別 discriminated union
  if (result.success) {
    // result 被縮小為 Success<T>
    console.log(result.data); // 類型安全
    return result.data;
  }
  // result 被縮小為 Failure
  console.error(result.error);
  return null;
}
```

### 實用類型增強

```ts
// 5.8 改進了 Partial、Required 等工具類型

interface Config {
  host: string;
  port: number;
  database: {
    name: string;
    user: string;
    password: string;
  };
}

// DeepPartial（實驗性）
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

## 在項目中的應用

```ts
// 實際項目中的 using 應用

// 1. 性能測量
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
  // ... 渲染邏輯
  // 自動輸出耗時
}

// 2. 事件監聽器管理
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

// 3. 鎖機制
using lock = new AsyncLock();
// 臨界區操作，自動釋放
```

## 小結

- TypeScript 5.7 支持 es2024 target，可以用 Object.groupBy 等新 API
- `using` 和 `await using` 是資源管理的重要特性，類似 Go 的 defer / Python 的 with
- 類型推斷持續改進，減少手動類型標註
- 保持 TS 版本更新，新特性會讓代碼更安全更簡潔
