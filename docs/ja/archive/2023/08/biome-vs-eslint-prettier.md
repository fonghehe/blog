---
title: "Biome：Rust 時代の Linter と Formatter"
date: 2023-08-08 10:39:00
tags:
  - ESLint
readingTime: 2
description: "Biome（原 Rome 项目重生）发布了。用 Rust 重写的 Linter + Formatter，对标 ESLint + Prettier。实测后说说值不值得换。"
---

Biome（原 Rome 项目重生）发布了。用 Rust 重写的 Linter + Formatter，对标 ESLint + Prettier。实测后说说值不值得换。

## なぜ代替案が必要なのか

ESLint + Prettier 的问题：

1. **慢**：大型项目 lint 一次要几十秒到几分钟
2. **配置复杂**：`.eslintrc` + `.prettierrc` + `eslint-config-*` + 各种插件
3. **规则冲突**：ESLint 的格式化规则和 Prettier 打架，需要 `eslint-config-prettier`
4. **Node.js 启动开销**：每次 lint 都有冷启动成本

Biome 的目标：一个工具搞定 lint + format，零配置起步。

## インストールと使い方

```bash
# 安装
pnpm add -D @biomejs/biome

# 初始化配置
pnpm biome init

# 格式化
pnpm biome format --write src/

# Lint
pnpm biome check src/

# Lint + Format 一步到位
pnpm biome check --apply src/
```

## 設定

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "useExhaustiveDependencies": "error",
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
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
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

一个 `biome.json` 解决所有配置，不需要装任何插件。

## パフォーマンス比較

在我们的项目上测试（~1500 个文件，TS + TSX）：

```
ESLint + Prettier:
  lint:    34s
  format:  12s
  total:   46s

Biome:
  check:   0.8s

提速约 57 倍。
```

这不是微优化。CI 里每次 PR 跑 lint 的时间从接近 1 分钟降到不到 1 秒。

## ルールのオーバーライド

```
ESLint 核心规则:    ~300 条
Biome linter 规则:  ~170 条（持续增加）
```

Biome 的规则覆盖了 ESLint 最常用的 80-90%。缺少的主要是：
- 框架特定规则（React exhaustive-deps 有，但 Vue 没有）
- 社区插件规则（import 排序有基础支持，但不如 eslint-plugin-import 强大）

## 移行戦略

**阶段一：只用 Formatter**

```bash
# 用 Biome 替换 Prettier
pnpm remove prettier
pnpm add -D @biomejs/biome
```

这是风险最低的一步。Biome 的格式化输出和 Prettier 高度兼容（默认风格略有差异，可配置）。

**阶段二：并行运行**

```jsonc
// package.json
{
  "scripts": {
    "lint:eslint": "eslint src/",
    "lint:biome": "biome check src/",
    "lint": "pnpm lint:eslint && pnpm lint:biome"
  }
}
```

对比两个工具的输出，看 Biome 是否漏报或误报。

**阶段三：全面切换**

確認没问题后移除 ESLint 相关依赖。

## 現在の制限

- Vue/Svelte 支持还不成熟
- 自定义规则能力远不如 ESLint（不能写插件）
- 部分 ESLint 规则没有对应实现
- 生态系统小，社区规则包几乎没有

## まとめ

- Biome 速度碾压 ESLint + Prettier，50 倍以上的性能提升不是吹的
- 配置极简，一个 JSON 文件搞定 lint + format
- 规则覆盖主流场景，但框架特定规则和生态不如 ESLint
- 建议先用 Formatter 替换 Prettier，Linter 规则按需迁移
- 新项目可以直接用 Biome；老项目评估规则覆盖后再决定