---
title: "Deno 初體驗：下一代 Node.js？"
date: 2020-03-10 17:20:21
tags:
  - Node.js
readingTime: 2
description: "Node.js 之父 Ryan Dahl 在 2018 年 JSConf 上批評了 Node.js 的十大設計遺憾，隨後宣佈了 Deno 項目。現在 Deno 已經進入候選版本階段，是時候體驗一下了。"
---

Node.js 之父 Ryan Dahl 在 2018 年 JSConf 上批評了 Node.js 的十大設計遺憾，隨後宣佈了 Deno 項目。現在 Deno 已經進入候選版本階段，是時候體驗一下了。

## Deno 解決了 Node.js 的哪些問題

Ryan Dahl 總結的 Node.js 十大遺憾中，Deno 重點解決：

1. **安全性**：Node.js 默認可以訪問所有系統資源，Deno 默認沙箱隔離
2. **模塊系統**：不使用 `node_modules`，直接通過 URL 導入
3. **TypeScript 支持**：內置 TypeScript 編譯器
4. **去中心化**：不需要 npm registry

## 快速上手

```bash
# 安裝（macOS）
curl -fsSL https://deno.land/x/install/install.sh | sh

# 驗證
deno --version
```

```typescript
// hello.ts —— 直接寫 TypeScript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('Deno'));
```

```bash
# 直接運行，不需要編譯步驟
deno run hello.ts
```

## 權限系統

這是 Deno 最大的安全創新：

```typescript
// file.ts
const data = await Deno.readFile('/etc/hosts');
console.log(new TextDecoder().decode(data));
```

```bash
# 默認拒絕訪問！必須顯式授權
deno run file.ts
# error: Uncaught PermissionDenied: read access to "/etc/hosts"

# 授權讀取
deno run --allow-read file.ts

# 只授權讀取特定目錄
deno run --allow-read=/tmp file.ts

# 網絡權限
deno run --allow-net=api.example.com server.ts

# 完全權限（不推薦）
deno run --allow-all file.ts
```

## URL 導入模塊

```typescript
// 不需要 npm install，直接導入
import { serve } from 'https://deno.land/std@0.50.0/http/server.ts';

const server = serve({ port: 8000 });
console.log('http://localhost:8000/');

for await (const req of server) {
  req.respond({ body: 'Hello Deno!\n' });
}
```

```bash
# 運行需要網絡權限
deno run --allow-net server.ts

# 第一次運行時下載依賴，之後有緩存
```

## 與 Node.js 的 API 對比

```typescript
// 文件操作
// Node.js
import { readFile } from 'fs/promises';
const content = await readFile('data.txt', 'utf-8');

// Deno
const content = await Deno.readTextFile('data.txt');

// HTTP 服務器
// Node.js (Express)
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Hello'));
app.listen(3000);

// Deno (Oak，類似 Koa)
import { Application } from 'https://deno.land/x/oak/mod.ts';
const app = new Application();
app.use(ctx => {
  ctx.response.body = 'Hello';
});
await app.listen({ port: 3000 });
```

## 現階段的侷限

```typescript
// 1. 生態系統：npm 有 100 萬+ 包，Deno 還很少
// 2. 兼容層尚不成熟
import * as path from 'https://deno.land/std/path/mod.ts';

// 3. 企業採用：幾乎沒有生產案例
// 4. 工具鏈：調試、IDE 支持不如 Node.js
// 5. 原生模塊：C++ addon 不支持
```

## 適合什麼場景

```markdown
現在適合：
- 腳本和工具（替代 shell 腳本）
- 小型 API 服務
- 技術探索和學習

暫時不適合：
- 企業級生產項目
- 需要大量 npm 包的項目
- 性能關鍵的後端服務
```

## 小結

- Deno 在安全性、TypeScript 支持、模塊系統上確實改進了 Node.js 的痛點
- 權限系統是最大亮點，默認最小權限原則
- URL 導入省去了 node_modules，但也帶來了網絡依賴問題
- 目前生態和工具鏈還不成熟，適合嚐鮮和工具腳本，不適合生產項目
- 持續關注，1.0 正式發佈後再評估是否引入
