---
title: "pnpm Workspace：告别 node_modules 地狱的 Monorepo 方案"
date: 2022-01-10 11:13:23
tags:
  - 前端工程化
readingTime: 2
description: "团队把多个前端项目迁移到 pnpm workspace 已经半年了。磁盘占用降了 60%，安装速度提升明显，幽灵依赖问题彻底解决。这篇文章记录我们的实践过程。"
wordCount: 433
---

团队把多个前端项目迁移到 pnpm workspace 已经半年了。磁盘占用降了 60%，安装速度提升明显，幽灵依赖问题彻底解决。这篇文章记录我们的实践过程。

## 为什么选 pnpm

npm 和 yarn 的 node_modules 是扁平结构，依赖提升带来两个问题：

1. **幽灵依赖**：你可以在代码里 import 没声明的包（因为被提升到了顶层）
2. **磁盘浪费**：不同项目各自维护一份完整的 node_modules

pnpm 用硬链接 + 内容寻址存储解决这两个问题：

```bash
# 全局安装 pnpm
npm install -g pnpm@7

# 查看全局存储
pnpm store path
# ~/.local/share/pnpm/store/v3
```

## 项目结构

我们前端 monorepo 的结构：

```
frontend-monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── ui-components/        # 组件库
│   ├── utils/                # 工具函数
│   ├── eslint-config/        # ESLint 共享配置
│   └── ts-config/            # TypeScript 共享配置
├── apps/
│   ├── admin/                # 后台管理
│   ├── h5/                   # 移动端 H5
│   └── docs/                 # 文档站
└── pnpm-lock.yaml
```

## pnpm-workspace.yaml 配置

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

根目录 `package.json`：

```json
{
  "name": "frontend-monorepo",
  "private": true,
  "scripts": {
    "dev:admin": "pnpm --filter admin dev",
    "dev:h5": "pnpm --filter h5 dev",
    "build:all": "pnpm -r build",
    "test:all": "pnpm -r test",
    "lint:all": "pnpm -r lint"
  },
  "engines": {
    "node": ">=16"
  }
}
```

## 工作区依赖管理

```bash
# 给 admin 项目安装 ui-components（workspace 协议）
pnpm --filter admin add ui-components@workspace:*

# 给 admin 安装 lodash（只装在 admin）
pnpm --filter admin add lodash

# 给所有项目安装 typescript（作为 devDependencies）
pnpm -r add -D typescript

# 给根目录安装全局开发工具
pnpm add -D -w husky lint-staged
```

安装后 `admin/package.json` 的依赖会是这样：

```json
{
  "dependencies": {
    "ui-components": "workspace:*",
    "lodash": "^4.17.21"
  }
}
```

`workspace:*` 表示永远使用本地版本，发布时 pnpm 会自动替换成真实版本号。

## .npmrc 配置

```ini
# 使用严格模式，不能访问未声明的依赖
strict-peer-dependencies=false

# 在项目级别创建 node_modules，保持兼容性
node-linker=hoisted

# 使用公共的 lockfile
shared-workspace-lockfile=true

# 自动安装 peerDependencies
auto-install-peers=false
```

`node-linker` 有三个选项：
- `isolated`（默认）：严格的符号链接结构，兼容性最差但最安全
- `hoisted`：类似 npm/yarn 的扁平结构，兼容性最好
- `hoisted`：折中方案

我们选 `hoisted` 是因为有些老依赖不支持严格的 node_modules 结构。

## 过滤器的妙用

```bash
# 只执行 admin 及其依赖的 build
pnpm --filter admin... build

# 执行 ui-components 被依赖的所有项目
pnpm --filter '...ui-components' build

# 结合使用：build 受影响的项目
pnpm --filter '...ui-components' --filter 'admin...' build

# 排除某些包
pnpm -r --no-filter docs test
```

这在 CI 里特别有用——只 build 和 test 有变更的项目。

## 踩坑记录

### 1. peerDependencies 警告

```json
// packages/ui-components/package.json
{
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  },
  "peerDependenciesMeta": {
    "react": { "optional": false },
    "react-dom": { "optional": false }
  }
}
```

pnpm 对 peerDependencies 严格，每个消费方都需要显式安装 react。

### 2. Workspace 协议的版本范围

```json
"ui-components": "workspace:^"   // 发布时替换为 ^1.2.3
"ui-components": "workspace:*"   // 发布时替换为 1.2.3（精确版本）
"ui-components": "workspace:~"   // 发布时替换为 ~1.2.3
```

### 3. 脚本执行顺序

```bash
# 按拓扑排序执行（先执行依赖，再执行消费方）
pnpm -r --workspace-concurrency=1 build

# 并行执行（更快但要确保 build 之间没有依赖）
pnpm -r build
```

## 迁移步骤总结

```bash
# 1. 全局安装 pnpm
npm install -g pnpm@7

# 2. 删除旧的 lock 文件和 node_modules
rm -rf node_modules package-lock.json yarn.lock

# 3. 初始化 workspace
echo "packages:
  - 'packages/*'
  - 'apps/*'" > pnpm-workspace.yaml

# 4. 安装依赖
pnpm install

# 5. 用 pnpm filter 替换原来的脚本
```

## 小结

pnpm workspace 在磁盘效率和依赖隔离上做到了最佳平衡。对于前端 monorepo，它是目前最务实的选择。接下来我会写 Turborepo 来做构建编排，配合 pnpm 组成完整的 monorepo 工具链。