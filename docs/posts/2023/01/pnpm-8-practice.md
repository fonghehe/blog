---
title: "pnpm 8：更快、更严格的包管理实践"
date: 2023-01-25 14:31:47
tags:
  - 前端
---

pnpm 8 发布了，作为我们团队的默认包管理器，升级后做了全面的性能对比测试。

## 核心改进

### 更快的安装速度

pnpm 8 对解析和链接阶段做了优化，在大型 monorepo 中提升明显：

```bash
# 我们项目的实际测试（1200+ 依赖，monorepo 含 15 个包）
# 冷安装（clean install）
npm:   89s
yarn:  62s
pnpm7: 38s
pnpm8: 24s

# 热安装（已有 lockfile，node_modules 被删除）
pnpm8: 11s
```

### Node.js 18+ 要求

pnpm 8 要求最低 Node.js 18，这是正确的决定。Node 16 已经 EME（维护期结束），放弃旧版本支持换来更好的性能。

### 更严格的依赖处理

默认行为变化：

```jsonc
// .npmrc
// pnpm 8 默认 strict-peer-dependencies = true
// 不再自动安装 peer dependencies
```

这看起来是个破坏性变更，但其实是好事。之前自动安装 peer dependencies 经常导致版本冲突。

## Monorepo 实践

### workspace 协议

```jsonc
// packages/ui/package.json
{
  "name": "@company/ui",
  "dependencies": {
    "@company/utils": "workspace:*",
    "@company/types": "workspace:^"
  }
}
```

`workspace:*` 始终使用本地版本，`workspace:^` 发布时会转成 `^x.y.z`。这是 pnpm 原生支持的，不需要额外配置。

### 高效的依赖提升

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// .npmrc
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

`public-hoist-pattern` 控制哪些依赖提升到根目录。和 npm/yarn 不同，pnpm 只提升你明确指定的包，避免幽灵依赖。

### 过滤命令

```bash
# 只在 apps 目录下执行构建
pnpm --filter="./apps/*" build

# 只构建 @company/ui 及其依赖
pnpm --filter "@company/ui..." build

# 构建所有依赖了 @company/utils 的包
pnpm --filter "...@company/utils" build
```

## 与 Turborepo 配合

```jsonc
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "test/**"]
    }
  }
}
```

pnpm workspace + Turborepo 是目前 monorepo 最佳组合。pnpm 管依赖，Turbo 管任务编排和缓存。

## 迁移注意点

```bash
# 从 pnpm 7 升级
pnpm -v  # 确认是 8.x

# 重新生成 lockfile
pnpm install --no-frozen-lockfile

# 检查 peer dependency 警告
pnpm install 2>&1 | grep "peer dep"
```

## 小结

- pnpm 8 安装速度提升约 35-40%（大型 monorepo）
- 默认严格 peer dependency 处理，减少了版本冲突
- Node.js 18+ 要求，拥抱现代运行时
- workspace 协议和过滤命令让 monorepo 管理更高效
- 配合 Turborepo 是当前前端 monorepo 最优解