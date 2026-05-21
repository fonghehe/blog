---
title: "TypeScript 5.2：using 宣言と型システムの進化"
date: 2023-09-28 10:22:50
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.2 带来了几个值得关注的特性，其中 `using` 声明是最具实用价值的。"
wordCount: 265
---

TypeScript 5.2 带来了几个值得关注的特性，其中 `using` 声明是最具实用价值的。

## using 宣言

TC39 的 Explicit Resource Management 提案进入 Stage 3，TypeScript 5.2 率先支持。它让资源清理变得自动且可靠。

```typescript
// 之前：手动管理
function processFile() {
  const file = openFile("data.txt");
  try {
    return process(file);
  } finally {
    file.close(); // 必须手动关闭
  }
}

// using 声明：离开作用域自动清理
function processFile() {
  using file = openFile("data.txt");
  return process(file);
} // file.close() 自动调用
```

### 实际应用：数据库连接

```typescript
class DatabaseConnection implements Disposable {
  constructor(private url: string) {
    console.log("连接数据库");
  }

  query(sql: string) {
    console.log(`执行: ${sql}`);
    return [{ id: 1, name: "test" }];
  }

  [Symbol.dispose]() {
    console.log("关闭数据库连接");
  }
}

function getUser(id: number) {
  using db = new DatabaseConnection("postgres://localhost/mydb");
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
} // 自动关闭连接，即使抛出异常也会关闭
```

### async using

```typescript
class FileHandle implements AsyncDisposable {
  constructor(private path: string) {}

  async read() {
    return await fs.promises.readFile(this.path, "utf-8");
  }

  async [Symbol.asyncDispose]() {
    console.log(`异步关闭文件: ${this.path}`);
  }
}

async function readConfig() {
  await using handle = new FileHandle("./config.json");
  const content = await handle.read();
  return JSON.parse(content);
} // 异步自动清理
```

### 配合锁和互斥量

```typescript
class Mutex implements Disposable {
  private locked = false;

  acquire() {
    // 简化示例
    this.locked = true;
    return this;
  }

  [Symbol.dispose]() {
    this.locked = false;
    console.log("锁已释放");
  }
}

function criticalSection() {
  using lock = new Mutex().acquire();
  // 临界区操作
  // 离开作用域自动释放锁，不会死锁
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
    console.log(`调用 ${methodName}`, args);
    return target.apply(this, args);
  };
}

class Calculator {
  @logged
  add(a: number, b: number) {
    return a + b;
  }
}

// metadata 可以在外部读取
const metadata = Calculator[Symbol.metadata];
console.log(metadata); // { add: { logged: true } }
```

## 名前付きおよび匿名 tuple 要素

```typescript
// TypeScript 5.2 支持命名 tuple 元素
type Coordinate = [x: number, y: number];
type Range = [start: number, end: number];

// 好处：IDE 提示更清晰
function moveTo(pos: Coordinate) {
  // hover 时显示：(parameter) pos: [x: number, y: number]
  console.log(pos[0], pos[1]);
}
```

## パフォーマンス最適化

TypeScript 5.2 在类型检查性能上有改进：

```
大型项目类型检查时间（~5000 文件）：
TS 5.1:  18s
TS 5.2:  14s
```

主要是优化了泛型实例化和条件类型的求值。

## 移行の推奨事項

```bash
# 更新
pnpm add -D typescript@^5.2.0

# 检查 breaking changes
npx tsc --noEmit

# 重点关注：
# 1. 某些宽松的类型推断变得更严格
# 2. 装饰器相关的类型定义可能需要更新
```

## まとめ

- `using` 声明让资源管理从"手动 finally"变成"自动清理"，减少资源泄漏
- `async using` 支持异步清理，数据库连接、文件句柄等场景非常实用
- Decorator Metadata 为装饰器生态提供了元数据存储能力
- 类型检查性能持续优化，大型项目受益明显
- TypeScript 5.2 是一个务实的版本，没有激进变化，但每天都在改善开发体验