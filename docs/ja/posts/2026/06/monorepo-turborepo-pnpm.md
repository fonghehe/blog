---
title: "Monorepo 2026：Turborepo と pnpm workspace の大規模プロジェクトガバナンス"
date: 2026-06-27 17:36:18
tags:
  - エンジニアリング
readingTime: 3
description: "Monorepo は大規模フロントエンドプロジェクトの標準アーキテクチャになった。Turborepo と pnpm workspace の大規模プロジェクトでの応用、ビルド最適化、依存関係管理、チームコラボレーションについて深く解説する。"
wordCount: 521
---

フロントエンドプロジェクトの規模が増すにつれ、Monorepo アーキテクチャは「選択肢」から「必然」へと進化した。2026 年、Turborepo と pnpm workspace の組み合わせは大規模フロントエンドプロジェクトを管理する主流ソリューションとなっている。その原理とベストプラクティスを理解することは、保守性の高いフロントエンドアーキテクチャを構築する鍵だ。

## Monorepo のコア価値

Monorepo のコア価値は「すべてのコードをリポジトリに集めること」ではない：

1. **アトミックな変更**：クロスパッケージの変更を単一のアトミックコミットにできる
2. **依存関係の一貫性**：すべてのパッケージが同じ依存バージョンを共有する
3. **コードの再利用**：共有コードを npm に公開する必要がない
4. **統一ツールチェーン**：すべてのパッケージが同じビルド、テスト、lint 設定を使用する

```bash
# 典型的な Monorepo 構造
frontend-monorepo/
├── apps/
│   ├── web/           # メインアプリケーション
│   ├── admin/         # 管理ダッシュボード
│   └── mobile/        # モバイルアプリ
├── packages/
│   ├── ui/            # UI コンポーネントライブラリ
│   ├── utils/         # ユーティリティ関数
│   ├── config/        # 共有設定
│   └── types/         # TypeScript 型定義
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## pnpm workspace の設定

### 基本設定

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// ルート package.json
{
  "name": "frontend-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

## Turborepo ビルド最適化

### 基本設定

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 高度な設定

```json
// turbo.json（高度な設定）
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "env": ["NODE_ENV", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": ["NODE_ENV"]
    }
  }
}
```

## 開発ワークフロー

### ローカル開発

```bash
# すべてのアプリケーションを起動
pnpm dev

# 特定のアプリケーションを起動
pnpm --filter @myorg/web dev

# 特定のパッケージとその依存関係を起動
pnpm --filter @myorg/web... dev
```

### ビルドとテスト

```bash
# すべてのパッケージをビルド
pnpm build

# 特定のパッケージをビルド
pnpm --filter @myorg/web build

# テスト実行
pnpm test
```

## チームコラボレーションパターン

### CI/CD 統合

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Test
        run: pnpm test
```

## まとめ

Monorepo アーキテクチャは Turborepo と pnpm workspace の組み合わせにより、大規模フロントエンドプロジェクトに効率的な開発体験を提供する。鍵は：適切なパッケージ分割、共有設定管理、依存バージョンのロック、キャッシュメカニズムの有効活用だ。プロジェクト規模の増大に伴い、这些実践はチームの開発効率とコード品質を大幅に向上できる。
