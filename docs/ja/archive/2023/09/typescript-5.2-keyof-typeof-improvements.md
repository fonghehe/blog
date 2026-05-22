---
title: "TypeScript 5.2：using 宣言と型システムの進化"
date: 2023-09-28 10:22:50
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.2 にはいくつかの注目すべき機能があります。その中でも using 宣言が最も実用的な価値を持っています。"
wordCount: 449
---

TypeScript 5.2 にはいくつかの注目すべき機能があります。その中でも `using` 宣言が最も実用的な価値を持っています。

## using 宣言

TC39 の Explicit Resource Management プロポーザルが Stage 3 に進み、TypeScript 5.2 が最初にサポートしました。これにより、リソースのクリーンアップが自動的かつ確実になります。

```typescript
// 以前：手動管理
function processFile() {
  const file = openFile("data.txt");
  try {
    return process(file);
  } finally {
    file.close(); // 手動で閉じる必要がある
  }
}

// using 宣言：スコープを離れると自動クリーンアップ
function processFile() {
  using file = openFile("data.txt");
  return process(file);
} // file.close() が自動的に呼び出される
```

### 実際の応用：データベース接続

```typescript
class DatabaseConnection implements Disposable {
  constructor(private url: string) {
    console.log("データベースに接続中");
  }

  query(sql: string) {
    console.log(`実行: ${sql}`);
    return [{ id: 1, name: "test" }];
  }

  [Symbol.dispose]() {
    console.log("データベース接続を閉じます");
  }
}

function getUser(id: number) {
  using db = new DatabaseConnection("postgres://localhost/mydb");
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
} // 自動的に接続を閉じる。例外が発生しても閉じられる
```

### async using

```typescript
class FileHandle implements AsyncDisposable {
  constructor(private path: string) {}

  async read() {
    return await fs.promises.readFile(this.path, "utf-8");
  }

  async [Symbol.asyncDispose]() {
    console.log(`ファイルを非同期で閉じます: ${this.path}`);
  }
}

async function readConfig() {
  await using handle = new FileHandle("./config.json");
  const content = await handle.read();
  return JSON.parse(content);
} // 非同期で自動クリーンアップ
```

### ロックとMutexの併用

```typescript
class Mutex implements Disposable {
  private locked = false;

  acquire() {
    // 簡略化した例
    this.locked = true;
    return this;
  }

  [Symbol.dispose]() {
    this.locked = false;
    console.log("ロックが解放されました");
  }
}

function criticalSection() {
  using lock = new Mutex().acquire();
  // クリティカルセクションの操作
  // スコープを離れると自動的にロックが解放されるため、デッドロックは発生しない
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

// metadata は外部から読み取り可能
const metadata = Calculator[Symbol.metadata];
console.log(metadata); // { add: { logged: true } }
```

## 名前付きおよび匿名 tuple 要素

```typescript
// TypeScript 5.2 は名前付きタプル要素をサポート
type Coordinate = [x: number, y: number];
type Range = [start: number, end: number];

// メリット：IDEのヒントがより明確に
function moveTo(pos: Coordinate) {
  // ホバー時に表示：(parameter) pos: [x: number, y: number]
  console.log(pos[0], pos[1]);
}
```

## パフォーマンス最適化

TypeScript 5.2 では型チェックのパフォーマンスが改善されています：

```
大規模プロジェクトの型チェック時間（約5000ファイル）：
TS 5.1:  18s
TS 5.2:  14s
```

主にジェネリックのインスタンス化と条件型の評価が最適化されました。

## 移行の推奨事項

```bash
# 更新
pnpm add -D typescript@^5.2.0

# breaking changes を確認
npx tsc --noEmit

# 注目すべき点：
# 1. 一部の緩やかな型推論がより厳密に
# 2. デコレータ関連の型定義の更新が必要な場合がある
```

## まとめ

- `using` 宣言により、リソース管理が「手動の finally」から「自動クリーンアップ」に変わり、リソースリークが減少します
- `async using` は非同期クリーンアップをサポートし、データベース接続やファイルハンドルなどのシーンで非常に実用的です
- Decorator Metadata はデコレータのエコシステムにメタデータ保存機能を提供します
- 型チェックのパフォーマンスは継続的に最適化され、大規模プロジェクトで顕著なメリットがあります
- TypeScript 5.2 は実用的なバージョンであり、急進的な変更はありませんが、日々の開発体験を改善しています
