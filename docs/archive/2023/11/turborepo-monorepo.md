---
title: "Turborepo：前端 Monorepo 的任务编排引擎"
date: 2023-11-25 14:31:00
tags:
  - 前端工程化
readingTime: 2
description: "Turborepo 成熟了。在我们的 15 个包的 monorepo 中使用了大半年，分享一下实践经验。"
---

Turborepo 成熟了。在我们的 15 个包的 monorepo 中使用了大半年，分享一下实践经验。

## 为什么选 Turborepo

Monorepo 工具选型：

- **Nx**：功能最全，但学习曲线陡峭，对非 JS 项目有偏好
- **Lerna**：版本管理为主，任务编排能力弱
- **Turborepo**：专注任务编排和缓存，上手简单，和 pnpm 配合好

我们的需求很简单：任务编排 + 缓存 + 并行执行。不需要 Nx 的全套功能。

## 基础配置

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- `dependsOn: ["^build"]`：先构建所有依赖包（`^` 表示依赖）
- `outputs`：定义缓存的产出文件
- `inputs`：定义影响缓存的输入文件（精确控制缓存失效）
- `cache: false`：dev 模式不缓存

## 工作原理

```
turbo build

1. 解析所有包的 package.json，构建依赖图
2. 按拓扑排序确定构建顺序
3. 并行执行没有依赖关系的任务
4. 每个任务的输入（源码 + 依赖 hash + 环境变量）生成 hash
5. 如果 hash 命中远程缓存，跳过执行，直接恢复 outputs
6. 执行结果上传到远程缓存
```

## 实际效果

```
# 首次构建（无缓存）
turbo build:  45s

# 只改了一个包的代码
turbo build:  3s  （其余 14 个包命中缓存）

# CI 中 PR 重复构建
turbo build:  <1s （全部命中远程缓存）
```

## 远程缓存

```bash
# 使用 Vercel Remote Cache（免费额度够用）
npx turbo login
npx turbo link

# 或者自建远程缓存
# 使用 turbo-server 或第三方方案
```

远程缓存让 CI 和本地共享构建缓存。同事已经构建过的代码，你拉下来直接用缓存。

## 与 pnpm workspace 配合

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// package.json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --parallel"
  }
}
```

pnpm 管依赖解析和安装，Turbo 管任务执行和缓存。职责清晰。

## 过滤和选择性执行

```bash
# 只构建某个包及其依赖
turbo run build --filter=@company/ui

# 只构建有变更的包
turbo run build --filter=[HEAD^1]

# 排除某些包
turbo run build --filter='!@company/docs'

# 只构建 apps 目录下的包
turbo run build --filter='./apps/*'
```

## 全局依赖和缓存失效

```jsonc
// turbo.json
{
  "globalDependencies": [
    // 这些文件变化会导致所有任务缓存失效
    ".env",
    "tsconfig.base.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      // 精确到每个任务的输入文件
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    }
  }
}
```

`globalDependencies` 很重要。如果忘记配置 `tsconfig.base.json`，改了基础配置但缓存不过期，会出诡异的构建问题。

## 小结

- Turborepo 专注做一件事：任务编排 + 缓存，做得很好
- 与 pnpm workspace 天然配合，各司其职
- 远程缓存是杀手级功能，CI 构建时间可以降到秒级
- 配置简单，`turbo.json` 一个文件搞定
- 不需要 Nx 那样的学习成本，适合大多数前端 monorepo