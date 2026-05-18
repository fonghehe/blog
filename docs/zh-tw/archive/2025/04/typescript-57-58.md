---
title: "TypeScript 5.7-5.8：型別系統的持續進化"
date: 2025-04-20 10:00:00
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.7 和 5.8 相繼釋出，帶來了一些實用的新特性。來整理一下對日常開發有影響的變化。"
---

TypeScript 5.7 和 5.8 相繼釋出，帶來了一些實用的新特性。來整理一下對日常開發有影響的變化。

## 5.7 新特性

### 相對路徑匯入補全

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
    // 支援 Object.groupBy、Map.groupBy 等新 API
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

### `using` 宣告（TC39 Stage 3）

```ts
// using 宣告：自動資源管理
// 離開作用域時自動呼叫 [Symbol.dispose]()

function processFile(path: string) {
  using file = openFile(path);
  // file 在函式結束時自動關閉

  const data = file.read();
  return data;
}

// 實際應用：資料庫連線管理
class DatabaseConnection {
  [Symbol.dispose]() {
    this.disconnect();
    console.log("資料庫連線已釋放");
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
  // db 在這裡自動 disconnect
}
```

### `await using` 宣告

```ts
// 非同步資源釋放
async function fetchData() {
  await using transaction = await db.beginTransaction();

  const users = await transaction.query("SELECT * FROM users");
  await transaction.query("UPDATE stats SET count = count + 1");

  return users;
  // transaction 在這裡自動 commit 或 rollback
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

### 增強的型別縮小

```ts
// 5.8 的型別推斷更智慧

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
    console.log(result.data); // 型別安全
    return result.data;
  }
  // result 被縮小為 Failure
  console.error(result.error);
  return null;
}
```

### 實用型別增強

```ts
// 5.8 改進了 Partial、Required 等工具型別

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
    // 只需要部分欄位
  },
};
```

## 在專案中的應用

```ts
// 實際專案中的 using 應用

// 1. 效能測量
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

- TypeScript 5.7 支援 es2024 target，可以用 Object.groupBy 等新 API
- `using` 和 `await using` 是資源管理的重要特性，類似 Go 的 defer / Python 的 with
- 型別推斷持續改進，減少手動型別標註
- 保持 TS 版本更新，新特性會讓程式碼更安全更簡潔
