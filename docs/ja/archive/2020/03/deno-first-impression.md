---
title: "Deno 初体験：次世代のNode.js？"
date: 2020-03-10 17:20:21
tags:
  - Node.js
readingTime: 2
description: "Node.js 之父 Ryan Dahl 在 2018 年 JSConf 上批评了 Node.js 的十大设计遗憾，随后宣布了 Deno 项目。现在 Deno 已经进入候选版本阶段，是时候体验一下了。"
wordCount: 504
---

Node.js の生みの親 Ryan Dahl は 2018 年の JSConf で Node.js の「十大設計上の後悔」を批判し、その直後に Deno プロジェクトを発表した。現在 Deno はリリース候補（RC）段階に入っており、そろそろ触れておく頃合いだ。

## DenoがNode.jsのどの問題を解決するか

Ryan Dahl がまとめた Node.js の「十大後悔」のうち、Deno が特に解消しようとしているのは以下の点だ：

1. **セキュリティ**：Node.js はデフォルトですべてのシステムリソースへアクセスできるが、Deno はデフォルトでサンドボックス隔離される
2. **モジュールシステム**：`node_modules` を使わず、直接 URL からインポートする
3. **TypeScript サポート**：TypeScript コンパイラを内蔵
4. **非中央集権**：npm registry を必要としない

## クイックスタート

```bash
# インストール（macOS）
curl -fsSL https://deno.land/x/install/install.sh | sh

# 確認
deno --version
```

```typescript
// hello.ts —— TypeScript をそのまま書ける
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('Deno'));
```

```bash
# コンパイル不要でそのまま実行
deno run hello.ts
```

## 権限システム

これは Deno 最大のセキュリティ上の工夫だ：

```typescript
// file.ts
const data = await Deno.readFile('/etc/hosts');
console.log(new TextDecoder().decode(data));
```

```bash
# デフォルトで拒否される！明示的な許可が必要
deno run file.ts
# error: Uncaught PermissionDenied: read access to "/etc/hosts"

# 読み取りを許可
deno run --allow-read file.ts

# 特定ディレクトリの読み取りのみ許可
deno run --allow-read=/tmp file.ts

# ネットワーク権限
deno run --allow-net=api.example.com server.ts

# 全権限（非推奨）
deno run --allow-all file.ts
```

## URL からのモジュールインポート

```typescript
// npm install 不要、そのままインポート
import { serve } from 'https://deno.land/std@0.50.0/http/server.ts';

const server = serve({ port: 8000 });
console.log('http://localhost:8000/');

for await (const req of server) {
  req.respond({ body: 'Hello Deno!\n' });
}
```

```bash
# 実行にはネットワーク権限が必要
deno run --allow-net server.ts

# 初回実行時に依存をダウンロード、以降はキャッシュされる
```

## Node.js との API 比較

```typescript
// ファイル操作
// Node.js
import { readFile } from 'fs/promises';
const content = await readFile('data.txt', 'utf-8');

// Deno
const content = await Deno.readTextFile('data.txt');

// HTTP サーバー
// Node.js（Express）
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Hello'));
app.listen(3000);

// Deno（Oak、Koa に似たもの）
import { Application } from 'https://deno.land/x/oak/mod.ts';
const app = new Application();
app.use(ctx => {
  ctx.response.body = 'Hello';
});
await app.listen({ port: 3000 });
```

## 現段階の限界

```typescript
// 1. エコシステム：npm には 100 万以上のパッケージがあるが、Deno はまだ少ない
// 2. 互換レイヤーはまだ発展途上
import * as path from 'https://deno.land/std/path/mod.ts';

// 3. 企業採用：本番事例はほとんどない
// 4. ツールチェーン：デバッグや IDE サポートが Node.js に劣る
// 5. ネイティブモジュール：C++ アドオンは非対応
```

## どんな場面に向いているか

```markdown
今のところ向いている：
- スクリプト・ツール（shell スクリプトの代替）
- 小規模な API サービス
- 技術調査・学習

今のところ向いていない：
- 企業向け本番プロジェクト
- 多数の npm パッケージを必要とするプロジェクト
- 性能がクリティカルなバックエンドサービス
```

## まとめ

- Deno はセキュリティ・TypeScript サポート・モジュールシステムで、Node.js の悩みの種を確かに改善している
- 権限システムが最大の目玉で、デフォルトは最小権限の原則
- URL インポートで node_modules が不要になる一方、ネットワーク依存という問題も生む
- 現時点ではエコシステムもツールチェーンも未成熟で、お試しやツール系スクリプトには向くが本番プロジェクトには不向き
- 継続的にウォッチし、1.0 の正式リリース後に導入するか再検討する
