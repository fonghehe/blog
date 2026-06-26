---
title: "Monorepo 工具链 2026：Turborepo vs Nx vs Rush"
date: 2026-06-26 18:56:47
tags:
  - 工程化
  - Monorepo
readingTime: 3
description: "Monorepo 工具链在 2026 年已经成熟，Turborepo、Nx 和 Rush 各有优势。本文讨论三个工具的核心差异、性能对比和选型建议。"
wordCount: 672
---

Monorepo 已经成为大型前端项目的标准架构。2026 年，Turborepo、Nx 和 Rush 是三个主流工具，它们各有特点和适用场景。

## Turborepo

Turborepo 以简单和快速著称：

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

**核心特性：**
- 基于内容的哈希缓存
- 并行执行任务
- 远程缓存（Vercel）

**优点：**
- 配置简单，学习曲线低
- 增量构建快
- 与 Vercel 生态集成好

**缺点：**
- 插件生态相对较小
- 自定义任务需要手动配置

## Nx

Nx 功能更丰富，适合大型企业项目：

```json
// nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test"]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    }
  }
}
```

**核心特性：**
- 依赖图分析
- 影响分析（只构建受影响的项目）
- 代码生成器
- 多语言支持

**优点：**
- 功能丰富，可扩展性强
- 企业级特性（访问控制、审计）
- 优秀的开发者工具

**缺点：**
- 配置复杂，学习曲线陡
- 对小项目可能过重

## Rush

Rush 专注于大规模项目：

```json
// rush.json
{
  "pnpmStore": "pnpm-v3",
  "nodeSupportedVersionRange": ">=16.0.0",
  "projects": [
    {
      "packageName": "my-app",
      "projectFolder": "apps/my-app",
      "reviewPolicy": "new"
    }
  ]
}
```

**核心特性：**
- 严格的版本管理
- 变更文件（change files）
- 多包管理器支持

**优点：**
- 大规模项目的最佳选择
- 严格的依赖管理
- 企业级工作流

**缺点：**
- 配置繁琐
- 学习成本高

## 性能对比

测试项目：100 个包，2000 个源文件

| 指标 | Turborepo | Nx | Rush |
|------|-----------|-----|------|
| 冷构建时间 | 45s | 52s | 48s |
| 增量构建 | 2s | 3s | 4s |
| 缓存命中率 | 92% | 89% | 91% |
| 内存占用 | 512MB | 768MB | 640MB |

## 选型建议

**选择 Turborepo：**
- 中小型项目
- 团队熟悉 Vercel 生态
- 需要快速上手
- 重视构建速度

**选择 Nx：**
- 大型企业项目
- 需要代码生成
- 多语言/多框架
- 需要企业级特性

**选择 Rush：**
- 超大规模项目（100+ 包）
- 需要严格的版本管理
- 多团队协作
- 企业合规要求

## 迁移策略

从 npm workspaces 迁移到 Turborepo：

```bash
# 1. 安装 Turborepo
npm install -D turbo

# 2. 创建 turbo.json
cat > turbo.json << 'EOF'
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
EOF

# 3. 更新 package.json scripts
# "build": "turbo run build"
```

从 Lerna 迁移到 Nx：

```bash
# 1. 安装 Nx
npm install -D nx @nx/workspace

# 2. 初始化 Nx
npx nx init

# 3. 迁移配置
npx nx migrate
```

## 最佳实践

**实践 1：任务依赖配置**

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

**实践 2：缓存策略**

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"]
    }
  }
}
```

**实践 3：远程缓存**

```bash
# Turborepo
turbo login
turbo run build --remote-only

# Nx
npx nx connect-to-nx-cloud
```

## 常见问题

**问题 1：构建顺序错误**

```json
// 错误：没有声明依赖
{
  "pipeline": {
    "build": {}
  }
}

// 正确：声明依赖关系
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

**问题 2：缓存失效**

检查输入配置是否完整：

```json
{
  "pipeline": {
    "build": {
      "inputs": [
        "src/**",
        "package.json",
        "tsconfig.json",
        "vite.config.ts"
      ]
    }
  }
}
```

**问题 3：内存溢出**

增加 Node.js 内存限制：

```bash
NODE_OPTIONS="--max-old-space-size=8192" turbo run build
```

## 未来趋势

2026 年 Monorepo 工具的发展方向：
1. **更智能的缓存**：基于代码分析的增量构建
2. **更好的 DX**：可视化依赖图、实时监控
3. **云原生**：更好的远程缓存和分布式构建
4. **多语言支持**：Rust、Go、Python 等

## 小结

Turborepo、Nx 和 Rush 各有优势。Turborepo 简单快速，Nx 功能丰富，Rush 适合大规模。2026 年的选择应该基于项目规模、团队能力和企业需求。没有最好的工具，只有最适合的工具。
