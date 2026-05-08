---
title: "发布一个 npm 包的完整流程"
date: 2019-06-26 09:37:41
tags:
  - Node.js
---

最近把项目中一个通用的工具函数抽成了 npm 包，完整走了一遍从初始化到发布的流程。记录下来，方便以后查阅，也希望能帮到有同样需求的同学。

## 初始化项目

创建一个新目录，然后执行 `npm init`：

```bash
mkdir my-awesome-utils
cd my-awesome-utils
npm init
```

`npm init` 会引导你填写一系列信息，生成 `package.json`。这里重点说几个关键字段。

## package.json 关键字段

```json
{
  "name": "my-awesome-utils",
  "version": "1.0.0",
  "description": "A collection of utility functions for frontend development",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "rollup -c",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test",
    "lint": "eslint src/"
  },
  "keywords": [
    "utils",
    "frontend",
    "javascript"
  ],
  "author": "fonghehe",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/fonghehe/my-awesome-utils.git"
  },
  "devDependencies": {
    "rollup": "^1.15.0",
    "jest": "^24.8.0"
  }
}
```

逐个解释：

- **`main`**：CommonJS 入口，`require('my-awesome-utils')` 会加载这个文件
- **`module`**：ES Module 入口，Webpack、Rollup 等打包工具会优先读取这个字段，支持 tree-shaking。这不是 npm 官方字段，但已是社区事实标准
- **`types`**：TypeScript 类型声明文件的入口，`tsc` 和 IDE 会根据这个字段提供类型提示
- **`files`**：指定发布到 npm 时包含哪些文件。没有这个字段，npm 会发布整个目录（除了 `.npmignore` 排除的）
- **`description`**：会显示在 npm 搜索结果中，写清楚便于搜索
- **`keywords`**：同样用于 npm 搜索，尽量覆盖用户可能搜索的关键词
- **`repository`**：npm 页面上会显示仓库链接，方便用户提 issue
- **`license`**：不写的话每次 `npm publish` 都会警告，开源项目一般选 MIT
- **`prepublishOnly`**：发布前自动执行的钩子，确保发布前代码是构建好的、测试通过的

## .npmignore vs files 字段

控制发布内容有两种方式：

**方式一：`files` 字段（推荐）**

```json
{
  "files": [
    "dist",
    "src"
  ]
}
```

白名单模式，只发布 `files` 中列出的文件。简洁明确，不容易出错。注意 `package.json`、`README.md`、`LICENSE` 和 `CHANGELOG` 始终会被包含，不需要显式列出。

**方式二：`.npmignore`**

```bash
# .npmignore
src/
test/
.eslintrc.js
jest.config.js
*.test.js
coverage/
.travis.yml
.editorconfig
```

黑名单模式，排除你不想要的文件。注意几个细节：

1. `.npmignore` 会覆盖 `.gitignore`。也就是说，如果 `.gitignore` 里排除了 `node_modules/` 但 `.npmignore` 里没有写，那 `node_modules/` 就会被发布出去——这很危险
2. 如果没有 `.npmignore`，npm 会使用 `.gitignore` 作为兜底
3. 和 `.gitignore` 语法一致，支持通配符和目录匹配

**对比总结**：

| | `files` 字段 | `.npmignore` |
|---|---|---|
| 模式 | 白名单 | 黑名单 |
| 安全性 | 高，不会意外发布 | 需要持续维护 |
| 可见性 | 在 package.json 中 | 单独文件 |
| 推荐场景 | 绝大多数情况 | 需要精细控制时 |

推荐用 `files` 字段，原因很简单：白名单更安全，且不需要维护额外的文件。

## 构建配置（Rollup 示例）

既然提到了 `module` 字段，就需要同时输出 CJS 和 ESM 两种格式。用 Rollup 比较方便：

```javascript
// rollup.config.js
export default [
  // CommonJS 输出
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    }
  },
  // ES Module 输出
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.esm.js',
      format: 'es'
    }
  }
];
```

这样消费者可以根据自己的打包工具选择合适的格式：

```javascript
// CommonJS 环境
const utils = require('my-awesome-utils')

// ES Module 环境（Webpack/Rollup 会自动选择 module 字段）
import { debounce, throttle } from 'my-awesome-utils'
```

为什么要同时输出两种格式？因为 Webpack 4+ 在解析到 `module` 字段时，会利用 ES Module 的静态分析能力做 tree-shaking，最终打包体积更小。而 Node.js 的 `require` 仍然走 CommonJS。

## 添加 TypeScript 类型声明

即使你的源码不是 TypeScript，也应该提供类型声明。这对使用 TypeScript 的团队来说是刚需，IDE 也能据此提供更好的自动补全。

**方式一：手写 `.d.ts` 文件**

如果源码是 JavaScript，可以单独写一个类型声明文件：

```typescript
// src/index.d.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void;

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void;

export function deepClone<T>(obj: T): T;

export function formatDate(date: Date, format: string): string;
```

**方式二：用 TypeScript 编写源码，自动编译出声明**

```json
// tsconfig.json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "moduleResolution": "node",
    "strict": true
  },
  "include": ["src"]
}
```

配置好 `declaration: true` 后，`tsc` 会自动为每个 `.ts` 文件生成对应的 `.d.ts` 文件。然后 `package.json` 中的 `"types": "dist/index.d.ts"` 指向它即可。

**验证类型声明是否生效**：

```bash
# 在另一个项目中本地链接测试
cd my-awesome-utils
npm link

cd ../another-project
npm link my-awesome-utils

# 然后看 IDE 是否能正确提示类型
```

## Scoped Packages

如果包名和别人的冲突了，或者想把所有包归到自己的命名空间下，可以用 scoped package：

```json
{
  "name": "@fonghehe/my-awesome-utils"
}
```

scoped 包默认是私有的，要发布为公开包需要加 `--access public`：

```bash
npm publish --access public
```

在团队内部很有用，比如 `@company/shared-utils`、`@company/ui-components` 这样的命名。安装时需要带上 scope：

```bash
npm install @fonghehe/my-awesome-utils
```

## 语义化版本（SemVer）

npm 遵循语义化版本规范：`主版本号.次版本号.修订号`（MAJOR.MINOR.PATCH）

```
1.0.0 → 1.0.1  修 bug（PATCH）
1.0.0 → 1.1.0  新增功能，向后兼容（MINOR）
1.0.0 → 2.0.0  破坏性变更（MAJOR）
```

发布时用 `npm version` 命令自动修改版本号并创建 git tag：

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

**预发布版本**：

```bash
npm version prerelease --preid=beta  # 1.0.0 → 1.0.1-beta.0
npm publish --tag beta               # 发布到 beta 标签
```

用户可以通过 `npm install my-awesome-utils@beta` 安装预发布版本。

`npm version` 还会自动创建 git tag，方便回溯每个版本对应的代码。

## npm publish 完整流程

```bash
# 1. 确保代码是最新的
git pull origin master

# 2. 登录（如果还没登录）
npm login

# 3. 检查将要发布的文件
npm pack --dry-run

# 4. 更新版本号（会自动创建 git tag）
npm version patch

# 5. 发布（prepublishOnly 钩子会自动执行 build 和 test）
npm publish

# 6. 推送 git tag
git push origin master --tags
```

`npm pack --dry-run` 非常有用，它会列出所有将被打包发布的文件及其大小，发布前务必检查一遍：

```bash
$ npm pack --dry-run
npm notice === Tarball Contents ===
npm notice 2.1kB  dist/index.js
npm notice 1.8kB  dist/index.esm.js
npm notice 0.4kB  dist/index.d.ts
npm notice 1.2kB  README.md
npm notice 1.1kB  LICENSE
npm notice === Tarball Details ===
npm notice name:          my-awesome-utils
npm notice version:       1.0.1
npm notice filename:      my-awesome-utils-1.0.1.tgz
npm notice package size:  2.3 kB
```

确认没有包含不该发布的文件（比如 `.env`、`node_modules`、测试文件等）。

## npm scripts 实用技巧

```json
{
  "scripts": {
    "dev": "rollup -c -w",
    "build": "rollup -c",
    "test": "jest --coverage",
    "lint": "eslint src/ --fix",
    "prepublishOnly": "npm run lint && npm run test && npm run build",
    "postversion": "git push origin master --tags"
  }
}
```

几个生命周期钩子的执行顺序：

1. `prepublishOnly` —— 发布前执行，最后的安全关卡
2. `prepack` / `postpack` —— 打包前后执行
3. `preversion` / `postversion` —— 修改版本号前后执行

`prepublishOnly` 是最关键的钩子，它确保了：代码风格检查不过 → 不发布；测试不过 → 不发布；构建失败 → 不发布。

## README 怎么写

README 是用户了解你包的第一入口，至少包含以下内容：

- 一句话说明这个包是干什么的
- 安装命令
- 最小可用示例（让用户 30 秒内跑起来）
- 完整的 API 文档
- License

```markdown
# my-awesome-utils

> 前端常用工具函数集合

## 安装

\`\`\`bash
npm install my-awesome-utils
# 或
yarn add my-awesome-utils
\`\`\`

## 使用

\`\`\`javascript
import { debounce, throttle, deepClone } from 'my-awesome-utils'

// 防抖：300ms 内多次触发只执行最后一次
const handleSearch = debounce((keyword) => {
  fetchSearchResults(keyword)
}, 300)

// 节流：每 200ms 最多执行一次
const handleScroll = throttle(() => {
  updateScrollPosition()
}, 200)

// 深拷贝
const newObj = deepClone({ a: { b: 1 } })
\`\`\`

## API

### debounce(fn, wait)
防抖函数，返回一个防抖后的函数。

### throttle(fn, wait)
节流函数，返回一个节流后的函数。

### deepClone(obj)
深拷贝，支持对象、数组、Date、RegExp 等类型。
```

写 README 的一个技巧：从一个新手的视角出发，假设他完全不了解你的包，能否在不看源码的情况下用起来。

## 撤销发布（unpublish）

如果刚发布的包有严重问题：

```bash
# 撤销指定版本（发布后 72 小时内，且没有其他包依赖）
npm unpublish my-awesome-utils@1.0.1

# 强制撤销（不推荐）
npm unpublish my-awesome-utils@1.0.1 --force

# 废弃某个版本（比 unpublish 更温和，用户安装时会收到警告）
npm deprecate my-awesome-utils@1.0.1 "请升级到 1.0.2，此版本有严重 bug"

# 废弃整个包的所有版本
npm deprecate my-awesome-utils "此包已迁移到 @fonghehe/utils，请更新依赖"
```

关键区别：

- `npm unpublish`：从 registry 彻底删除，其他依赖它的项目会安装失败。npm 有 72 小时限制，且如果有人依赖了你的包则不允许 unpublish
- `npm deprecate`：包还在，只是安装时会显示警告。对已有用户更友好

**最佳实践**：不要 unpublish，而是 deprecate + 发布修复版本。unpublish 会破坏其他项目的构建，尤其是你的包被间接依赖时。

## 小结

- `package.json` 中 `main`、`module`、`types` 三个字段分别对应 CJS 入口、ESM 入口和类型声明，打包工具会按需读取
- 用 `files` 字段白名单控制发布内容，比 `.npmignore` 更安全
- TypeScript 类型声明对 TS 用户是刚需，即使源码是 JS 也应该提供
- `npm pack --dry-run` 发布前检查打包内容，避免泄露敏感文件
- 遵循语义化版本，用 `npm version` 自动管理版本号和 git tag
- `prepublishOnly` 钩子确保发布前自动执行 lint、test、build，防止发布有问题的代码
- unpublish 是最后手段，优先用 deprecate + 修复版本处理问题
