---
title: "Node.js 14 新特性对前端的影响"
date: 2020-07-07 10:40:44
tags:
  - JavaScript
---

Node.js 14 进入 LTS 阶段，升级了 V8 引擎到 8.1，带来了一些实用的新特性。作为前端工程师，这些变化直接影响我们的构建工具和脚本。

## 可选链和空值合并在 Node.js 中原生支持

```javascript
// 不需要 --harmony 标志了！
// Node.js 14 直接支持

// 可选链
const config = {
  database: {
    host: 'localhost',
  },
};

const port = config?.database?.port ?? 3306;
console.log(port); // 3306

// 空值合并
const timeout = process.env.TIMEOUT ?? 5000;

// 实际场景：处理 API 响应
function processResponse(response) {
  const users = response?.data?.users ?? [];
  const total = response?.data?.total ?? 0;
  return { users, total };
}
```

## Top-level await

```javascript
// 以前：必须包在 async 函数里
async function main() {
  const config = await loadConfig();
  const db = await connectDB(config);
  // ...
}
main();

// Node.js 14：顶层 await
// config.mjs
const config = await import('./config.json');
const response = await fetch('https://api.example.com/data');
const data = await response.json();

console.log('配置加载完成:', config);
console.log('数据获取完成:', data);

// 注意：只能在 .mjs 或 package.json 中 type: "module" 的文件中使用
```

```json
// package.json 启用 ESM
{
  "type": "module"
}
```

## Intl.DisplayNames：国际化名称显示

```javascript
// 以前需要一个映射表
const langMap = { zh: '中文', en: 'English', ja: '日本語' };

// Node.js 14：内置 API
const regionNames = new Intl.DisplayNames(['zh'], { type: 'region' });
console.log(regionNames.of('CN')); // 中国
console.log(regionNames.of('US')); // 美国

const langNames = new Intl.DisplayNames(['zh'], { type: 'language' });
console.log(langNames.of('zh')); // 中文
console.log(langNames.of('en')); // 英语

// 实际场景：国际化表单中的国家选择
function getCountryOptions(locale = 'zh') {
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  return ['CN', 'US', 'JP', 'KR', 'GB'].map(code => ({
    value: code,
    label: regionNames.of(code),
  }));
}
// [{ value: 'CN', label: '中国' }, { value: 'US', label: '美国' }, ...]
```

## 更好的错误堆栈

```javascript
// Node.js 14 的错误堆栈更清晰
// 以前会显示一些无用的 internal/frames

function inner() {
  throw new Error('Something went wrong');
}

function middle() {
  inner();
}

function outer() {
  middle();
}

outer();
// Error: Something went wrong
//     at inner (file:///app/test.js:2:9)
//     at middle (file:///app/test.js:6:3)
//     at outer (file:///app/test.js:10:3)
// 干净多了，没有 internal 的噪音
```

## Stream 性能提升

```javascript
// readable.iterator() 支持 for-await-of
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function processLargeFile(filePath) {
  const stream = createReadStream(filePath);
  const rl = createInterface({ input: stream });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    // 逐行处理大文件，不会 OOM
    if (line.includes('ERROR')) {
      console.error(`第 ${lineCount} 行发现错误: ${line}`);
    }
  }

  return lineCount;
}
```

## 对前端工具链的影响

```javascript
// Webpack 5 要求 Node.js >= 10.13.0，14 完全兼容
// Vite 要求 Node.js >= 12.0.0，14 完全兼容
// TypeScript 4.0 支持 Node.js 14

// esbuild 最佳性能在 Node.js 14 上
// Deno 兼容性层需要 Node.js 14+

// 检查版本的脚本
// scripts/check-node.js
const semver = require('semver');
const required = '>=14.0.0';

if (!semver.satisfies(process.version, required)) {
  console.error(`需要 Node.js ${required}，当前版本 ${process.version}`);
  process.exit(1);
}

console.log(`Node.js ${process.version} ✓`);
```

## 升级注意事项

```bash
# 推荐用 nvm 管理 Node.js 版本
nvm install 14
nvm use 14

# 检查破坏性变更
# 1. 一些废弃的 API 被移除了
# 2. URL.parse() 被废弃，用 new URL() 替代
# 3. 一些 Buffer 方法被废弃

# CI 配置更新
# .github/workflows/ci.yml
- uses: actions/setup-node@v2
  with:
    node-version: '14'
```

## 小结

- 可选链和空值合并在 Node.js 中原生支持，构建脚本也可以用了
- Top-level await 简化了 ESM 模块的异步初始化代码
- Intl.DisplayNames 内置国际化名称显示，不再需要手动映射
- 错误堆栈更干净，调试体验更好
- 建议尽快升级到 Node.js 14 LTS
