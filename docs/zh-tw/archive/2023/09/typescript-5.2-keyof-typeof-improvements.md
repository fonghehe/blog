---
title: "TypeScript 5.2：using 宣告與型別系統演進"
date: 2023-09-28 10:22:50
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.2 帶來了幾個值得關注的特性，其中 `using` 宣告是最具實用價值的。"
wordCount: 257
---

TypeScript 5.2 帶來了幾個值得關注的特性，其中 `using` 宣告是最具實用價值的。

## using 宣告

TC39 的 Explicit Resource Management 提案進入 Stage 3，TypeScript 5.2 率先支援。它讓資源清理變得自動且可靠。

```typescript
// 之前：手動管理
function processFile() {
  const file = openFile("data.txt");
  try {
    return process(file);
  } finally {
    file.close(); // 必須手動關閉
  }
}

// using 宣告：離開作用域自動清理
function processFile() {
  using file = openFile("data.txt");
  return process(file);
} // file.close() 自動呼叫
```

### 實際應用：資料庫連線

```typescript
class DatabaseConnection implements Disposable {
  constructor(private url: string) {
    console.log("連線資料庫");
  }

  query(sql: string) {
    console.log(`執行: ${sql}`);
    return [{ id: 1, name: "test" }];
  }

  [Symbol.dispose]() {
    console.log("關閉資料庫連線");
  }
}

function getUser(id: number) {
  using db = new DatabaseConnection("postgres://localhost/mydb");
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
} // 自動關閉連線，即使丟擲異常也會關閉
```

### async using

```typescript
class FileHandle implements AsyncDisposable {
  constructor(private path: string) {}

  async read() {
    return await fs.promises.readFile(this.path, "utf-8");
  }

  async [Symbol.asyncDispose]() {
    console.log(`非同步關閉檔案: ${this.path}`);
  }
}

async function readConfig() {
  await using handle = new FileHandle("./config.json");
  const content = await handle.read();
  return JSON.parse(content);
} // 非同步自動清理
```

### 配合鎖和互斥量

```typescript
class Mutex implements Disposable {
  private locked = false;

  acquire() {
    // 簡化示例
    this.locked = true;
    return this;
  }

  [Symbol.dispose]() {
    this.locked = false;
    console.log("鎖已釋放");
  }
}

function criticalSection() {
  using lock = new Mutex().acquire();
  // 臨界區操作
  // 離開作用域自動釋放鎖，不會死鎖
}
```

## Decorator Metadata（Stage 3）

```typescript
function logged(
  target: Function,
  context: ClassMethodDecoratorContext,
) {
  const methodName = String(context.name);

  context.metadata[methodName] = { logged: true };

  return function (this: any, ...args: any[]) {
    console.log(`呼叫 ${methodName}`, args);
    return target.apply(this, args);
  };
}

class Calculator {
  @logged
  add(a: number, b: number) {
    return a + b;
  }
}

// metadata 可以在外部讀取
const metadata = Calculator[Symbol.metadata];
console.log(metadata); // { add: { logged: true } }
```

## 命名和匿名 tuple 元素

```typescript
// TypeScript 5.2 支援命名 tuple 元素
type Coordinate = [x: number, y: number];
type Range = [start: number, end: number];

// 好處：IDE 提示更清晰
function moveTo(pos: Coordinate) {
  // hover 時顯示：(parameter) pos: [x: number, y: number]
  console.log(pos[0], pos[1]);
}
```

## 效能最佳化

TypeScript 5.2 在型別檢查效能上有改進：

```
大型專案型別檢查時間（~5000 檔案）：
TS 5.1:  18s
TS 5.2:  14s
```

主要是優化了泛型例項化和條件型別的求值。

## 遷移建議

```bash
# 更新
pnpm add -D typescript@^5.2.0

# 檢查 breaking changes
npx tsc --noEmit

# 重點關注：
# 1. 某些寬鬆的型別推斷變得更嚴格
# 2. 裝飾器相關的型別定義可能需要更新
```

## 小結

- `using` 宣告讓資源管理從"手動 finally"變成"自動清理"，減少資源洩漏
- `async using` 支援非同步清理，資料庫連線、檔案控制代碼等場景非常實用
- Decorator Metadata 為裝飾器生態提供了後設資料儲存能力
- 型別檢查效能持續最佳化，大型專案受益明顯
- TypeScript 5.2 是一個務實的版本，沒有激進變化，但每天都在改善開發體驗