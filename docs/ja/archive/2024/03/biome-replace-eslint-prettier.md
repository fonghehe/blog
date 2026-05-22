---
title: "Biome：Rust製フロントエンドツールチェーン、本当に ESLint + Prettier を置き換えられるか"
date: 2024-03-08 15:28:27
tags:
  - ESLint
readingTime: 2
description: "Biome 1.0 がリリースされ、ESLint + Prettier を置き換えると宣言しています。実際の体験を見てみましょう。"
wordCount: 561
---

Biome 1.0 がリリースされ、ESLint + Prettier を置き換えると宣言しています。実際の体験を見てみましょう。

## まずスピードについて

中規模プロジェクト（約 200 の TS/TSX ファイル）での結果：

```
ESLint + Prettier（Node.js）：~8s
Biome（Rust）：~0.4s

20倍的速度差
```

この差は CI 上で顕著ですが、ローカル開発での体感差はそれほど大きくありません。

## インストールと設定

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

## よく使うコマンド

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

## 既存プロジェクトの移行

Biome は移行コマンドを提供しています：

```bash
# 从 ESLint 迁移
npx @biomejs/biome migrate eslint --write

# 从 Prettier 迁移
npx @biomejs/biome migrate prettier --write
```

実際の移行体験：ほとんどのルールは自動変換できますが、一部の ESLint プラグイン（`eslint-plugin-react-hooks` など）には Biome の同等実装がまだありません。

## 現在の課題

**ルールのカバレッジ不足**：

| シナリオ                  | ESLint プラグイン            | Biome のサポート                           |
| ------------------------- | ---------------------------- | ----------------------------------------- |
| React Hooks ルール        | eslint-plugin-react-hooks    | 一部対応（hooks-of-components など）      |
| アクセシビリティチェック  | eslint-plugin-jsx-a11y       | 基本的な対応                              |
| Import 並び替え           | eslint-plugin-import         | ✅ 内蔵                                   |
| TypeScript 型チェック     | @typescript-eslint           | 一部対応                                  |

**エコシステムの未熟さ**：多くのサードパーティ ESLint プラグインには Biome 版がありません。

## 私のアドバイス

**新規プロジェクト**：そのまま Biome を使用し、初期状態からの高速動作を実感できます。

**既存プロジェクト**：

```
公式ルールを主に使用している場合（サードパーティプラグインが少ない）→ 移行する価値あり
@typescript-eslint、react-hooks などのプラグインに大きく依存している場合 → Biome のエコシステムが成熟するのを待つ
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

Biome で Prettier（フォーマット）を代替し、ESLint で型関連の lint を処理します。これにより速度とカバレッジの両方を両立できます。

## まとめ

- Biome の速度は ESLint + Prettier より約20倍速い
- 設定は ESLint + Prettier よりはるかにシンプル
- ルールのカバレッジは ESLint エコシステムほど完全ではない、特に react-hooks
- 新規プロジェクトには推奨、既存プロジェクトは状況に応じて移行
- 混用：Biome でフォーマット + ESLint で lint は良い妥協案