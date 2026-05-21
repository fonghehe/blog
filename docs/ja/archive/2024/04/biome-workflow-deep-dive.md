---
title: "Biome 完全ワークフロー：移行、CI 統合、チーム標準化"
date: 2024-04-28 14:31:44
tags:
  - フロントエンド
readingTime: 3
description: "以前、Biome が ESLint + Prettier を置き換えられるかどうかの分析を書きました。数ヶ月間チームに全面展開した後、完全なワークフロー経験をまとめます。"
wordCount: 622
---

以前、Biome が ESLint + Prettier を置き換えられるかどうかの分析を書きました。数ヶ月間チームに全面展開した後、完全なワークフロー経験をまとめます。

## 移行戦略：段階的な置き換え

一度に全て移行することはお勧めしません。私たちのアプローチ：

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

重要なステップ：既存のコードをフォーマットして大きなコミットを一度行い、後続の PR に diff が汚染されないようにします：

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

見落としがないよう、マッピングテーブルを維持しました：

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

`biome ci` コマンドは以下を行います：
- フォーマットの確認
- lint チェックの実行
- import の順序確認
- 非ゼロ終了コードで CI をブロック

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

## 発生した問題

### 1. 规则不完全对等

Biome のルールと ESLint は 1:1 のマッピングではありません。一部の ESLint プラグインルール（例：`eslint-plugin-react` の一部のルール）はまだ Biome でサポートされていません。

解決策：少数の ESLint ルールを補完として保持し、`eslint-plugin-only-warn` を使用して警告にダウングレードします。

### 2. ignore 文件差异

Biome は `.eslintignore` の代わりに `.biomeignore` を使用し、構文が若干異なります：

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

## まとめ

- 渐进式迁移：formatter → linter（并行）→ linter（接管）→ 移除旧依赖
- 格式化先做一次大提交，避免 diff 污染
- CI 必须用 `biome ci` 命令强制检查
- 维护 ESLint → Biome 规则映射表，确保不遗漏
- 团队落地速度约 2 周，主要成本在第一次格式化