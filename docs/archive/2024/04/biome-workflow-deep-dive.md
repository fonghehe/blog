---
title: "Biome 完整工作流：从迁移、CI 集成到团队规范"
date: 2024-04-28 14:31:44
tags:
  - 前端
readingTime: 2
description: "之前写过 Biome 能否替代 ESLint + Prettier 的分析。经过几个月在团队中全面推广，整理一下完整的工作流经验。"
wordCount: 464
---

之前写过 Biome 能否替代 ESLint + Prettier 的分析。经过几个月在团队中全面推广，整理一下完整的工作流经验。

## 迁移策略：渐进式替换

不建议一步到位。我们的路径：

```
阶段 1：Biome 作为 formatter 替代 Prettier（风险最低）
阶段 2：Biome 作为 linter，和 ESLint 并行运行
阶段 3：逐步关闭 ESLint 规则，Biome 接管
阶段 4：移除 ESLint + Prettier 依赖
```

### 阶段 1：格式化迁移

```bash
# 安装 Biome
pnpm add -D @biomejs/biome

# 生成配置
npx @biomejs/biome init
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.7.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "organizeImports": {
    "enabled": true
  }
}
```

关键一步：格式化现有代码并做一次大提交，避免 diff 污染后续 PR：

```bash
npx @biomejs/biome format --write .
git add -A && git commit -m "chore: apply biome formatting to all files"
```

### 阶段 2-3：Linter 迁移

```json
// biome.json 补充 linter 配置
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useTemplate": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": ["error", { "max": 15 }]
      }
    }
  }
}
```

### ESLint 规则映射表

我们维护了一份映射表，确保不遗漏：

```json
// eslint-to-biome-mapping.json
{
  "react-hooks/exhaustive-deps": "correctness/useExhaustiveDependencies",
  "@typescript-eslint/no-unused-vars": "correctness/noUnusedVariables",
  "no-unused-vars": "correctness/noUnusedVariables",
  "eqeqeq": "suspicious/noDoubleEquals",
  "no-console": "suspicious/noConsoleLog",
  "prefer-const": "style/useConst"
}
```

## CI 集成

```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .
```

`biome ci` 命令会：
- 检查格式（format）
- 检查 lint
- 检查 import 排序
- 以非零退出码失败时阻断 CI

### Pre-commit Hook

```json
// package.json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint"
  }
}
```

## 遇到的问题

### 1. 规则不完全对等

Biome 的规则和 ESLint 不是 1:1 映射。有些 ESLint 插件规则（如 `eslint-plugin-react` 的某些规则）Biome 还不支持。

解决方案：保留少量 ESLint 规则作为补充，用 `eslint-plugin-only-warn` 降级为 warning。

### 2. ignore 文件差异

Biome 用 `.biomeignore` 而不是 `.eslintignore`，语法略有不同：

```
# .biomeignore
dist/
build/
*.min.js
```

### 3. IDE 集成

VS Code 的 Biome 扩展比 ESLint 扩展年轻，偶尔会有卡顿。解决方案是重启 LSP server。

## 团队落地经验

**关键：一次格式化提交**。不做这一步，每个 PR 都混着格式变更，review 极其痛苦。

**CI 必须强制**。光靠本地 IDE 提示不够，CI 不通过就无法合并。

**团队培训**。花了 30 分钟给团队做了个内部分享，重点讲规则含义而不是配置语法。

## 小结

- 渐进式迁移：formatter → linter（并行）→ linter（接管）→ 移除旧依赖
- 格式化先做一次大提交，避免 diff 污染
- CI 必须用 `biome ci` 命令强制检查
- 维护 ESLint → Biome 规则映射表，确保不遗漏
- 团队落地速度约 2 周，主要成本在第一次格式化