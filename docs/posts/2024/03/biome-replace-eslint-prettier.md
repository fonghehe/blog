---
title: "Biome：Rust 写的前端工具链，真的能替代 ESLint + Prettier 吗"
date: 2024-03-08 15:28:27
tags:
  - ESLint
---

Biome 1.0 发布，宣称能替代 ESLint + Prettier。来看看实际体验怎么样。

## 先说速度

在一个中等规模项目（约 200 个 TS/TSX 文件）：

```
ESLint + Prettier（Node.js）：~8s
Biome（Rust）：~0.4s

20倍的速度差
```

这个差距在 CI 上很明显，本地开发的感受差异没有那么大。

## 安装和配置

```bash
npm install --save-dev --save-exact @biomejs/biome
npx @biomejs/biome init
```

```json
// biome.json（比 .eslintrc + .prettierrc 简单得多）
{
  "$schema": "https://biomejs.dev/schemas/1.5.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  }
}
```

## 常用命令

```bash
# 格式化
npx biome format --write .

# Lint 检查
npx biome lint .

# 同时格式化 + lint（最常用）
npx biome check --write .

# CI 模式（不修改文件，只检查）
npx biome ci .
```

## 和现有项目迁移

Biome 提供了迁移命令：

```bash
# 从 ESLint 迁移
npx @biomejs/biome migrate eslint --write

# 从 Prettier 迁移
npx @biomejs/biome migrate prettier --write
```

实际迁移体验：大部分规则能自动转换，但有些 ESLint 插件（如 `eslint-plugin-react-hooks`）还没有 Biome 等价实现。

## 目前的不足

**规则覆盖率不够**：

| 场景                | ESLint 插件               | Biome 支持                         |
| ------------------- | ------------------------- | ---------------------------------- |
| React Hooks 规则    | eslint-plugin-react-hooks | 部分支持（hooks-of-components 等） |
| 无障碍检查          | eslint-plugin-jsx-a11y    | 基础支持                           |
| Import 排序         | eslint-plugin-import      | ✅ 内置                            |
| TypeScript 类型检查 | @typescript-eslint        | 部分支持                           |

**生态不成熟**：很多第三方 ESLint 插件没有 Biome 版本。

## 我的建议

**新项目**：直接用 Biome，享受开箱即用的速度。

**现有项目**：

```
如果你的项目主要用官方规则（无太多第三方插件）→ 值得迁移
如果严重依赖 @typescript-eslint、react-hooks 等插件 → 等 Biome 生态成熟
```

**混用方案**（我目前的实践）：

```json
// package.json
{
  "scripts": {
    "format": "biome format --write .",
    "lint": "biome lint . && eslint . --max-warnings 0",
    "check": "biome check --write . && eslint . --max-warnings 0"
  }
}
```

用 Biome 替代 Prettier（格式化），用 ESLint 处理类型相关的 lint。这样速度和覆盖率都能兼顾。

## 小结

- Biome 速度比 ESLint + Prettier 快 20 倍左右
- 配置比 ESLint + Prettier 简单得多
- 规则覆盖率还不如 ESLint 生态完整，特别是 react-hooks
- 新项目推荐，老项目视情况迁移
- 混用：用 Biome 格式化 + ESLint lint 是个好折中