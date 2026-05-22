---
title: "Turborepo：Monorepo ビルドオーケストレーションの最良パートナー"
date: 2022-03-08 10:39:07
tags:
  - フロントエンド
readingTime: 4
description: "前回は pnpm workspace による依存関係管理について書きました。今回はビルドオーケストレーションについてです。monorepo に十数個のパッケージがあり、それらをビルドしてテストする必要がある場合、どのように依存関係の順序に従って実行し、かつ可能な限り並列化するかを解説します。"
wordCount: 821
---

前回は pnpm workspace による依存関係管理について書きました。今回はビルドオーケストレーションについてです。monorepo に十数個のパッケージがあり、それらをビルドしてテストする必要がある場合、どのように依存関係の順序に従って実行し、かつ可能な限り並列化するかを解説します。

Turborepo がその答えです。これはビルドオーケストレーションツールであり、pnpm を置き換えるものではなく、pnpm と連携して動作します。

## インストールと初期化

```bash
# 既存の pnpm workspace プロジェクトで
pnpm add -D -w turbo
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
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

重要な設定の説明：

- `dependsOn: ["^build"]`：現在のパッケージの build が、すべてのワークスペース依存関係の build に依存することを示します（`^` は依存関係を示す）
- `dependsOn: ["build"]`：test が現在のパッケージ自身の build に依存することを示します
- `outputs`：ビルド成果物のパス。Turborepo がキャッシュに使用します
- `cache: false`：dev はキャッシュしない
- `persistent: true`：dev は常駐プロセス

## コマンドの実行

```bash
# すべてのパッケージをビルド（トポロジカルソート + 並列）
turbo run build

# 変更があったパッケージのみビルド
turbo run build --filter=...[HEAD]

# admin とそのすべての依存関係をビルド
turbo run build --filter=admin...

# すべてのパッケージをテスト
turbo run test

# 複数のタスクを並列実行
turbo run build test lint

# 開発モード（全パッケージを同時起動）
turbo run dev --parallel
```

## リモートキャッシュ

Turborepo の最も魅力的な機能——CI とローカルでビルドキャッシュを共有：

```bash
# Vercel にログイン（Turborepo 公式ホスティング）
npx turbo login

# リモートキャッシュにリンク
npx turbo link
```

リモートキャッシュを自前で構築することもできます：

```json
// turbo.json
{
  "remoteCache": {
    "apiUrl": "https://your-cache-server.com",
    "token": "your-token"
  }
}
```

```bash
# CI で使用（GitHub Actions）
- name: Build
  run: turbo run build test
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

効果：初回の CI ビルド後、後続の PR でビルドソースコードに変更がなければ、キャッシュがヒットし、ビルドが 3 分から 5 秒に短縮されます。

## 実際のプロジェクト設定

私たちの monorepo 構成：

```
frontend-monorepo/
├── packages/
│   ├── ui-components/     # 构建产物 dist/
│   ├── utils/             # 构建产物 dist/
│   ├── eslint-config/     # 无构建，只有 lint
│   └── ts-config/         # 无构建
├── apps/
│   ├── admin/             # 构建产物 dist/
│   ├── h5/                # 构建产物 dist/
│   └── docs/              # 构建产物 dist/
└── turbo.json
```

対応する turbo.json：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env*", "tsconfig.base.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".output/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "test/**", "vitest.config.*"]
    },
    "lint": {
      "outputs": [],
      "inputs": ["src/**", "*.config.*", ".eslintrc*"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "storybook": {
      "cache": false,
      "persistent": true
    }
  }
}
```

`globalDependencies` はすべてのパッケージに影響を与えるファイルを定義します——これらのファイルが変更されると、すべてのキャッシュが無効になります。

## フィルターの高度な使い方

```bash
# apps ディレクトリ内のすべてのパッケージをビルド
turbo run build --filter='./apps/*'

# ui-components とそのすべての使用者をビルド
turbo run build --filter='...ui-components'

# docs パッケージを除外
turbo run build --filter='!docs'

# 組み合わせ：現在の git diff の影響を受けるパッケージをビルド
turbo run build --filter='...[HEAD^]'
```

## GitHub Actions の統合

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # 変更を判断するために完全な履歴が必要

      - uses: pnpm/action-setup@v2
        with:
          version: 7

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build & Test
        run: turbo run build test lint
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

## pnpm + Turborepo の役割分担

| 機能 | pnpm workspace | Turborepo |
|------|---------------|-----------|
| 依存関係管理 | 担当 | 担当外 |
| workspace プロトコル | 担当 | 担当外 |
| ビルドオーケストレーション | 基本（-r） | 担当 |
| 並列実行 | 基本 | スマート並列 |
| ビルドキャッシュ | なし | ローカル + リモート |
| タスクパイプライン | なし | 完全サポート |

簡単に言えば：pnpm は依存関係を管理し、Turborepo はビルドを管理します。

## まとめ

Turborepo は monorepo のビルドオーケストレーションにおける軽量なソリューションです。パッケージ管理は行わず（pnpm が担当）、タスクのオーケストレーションとキャッシュに特化しています。中小規模の monorepo であれば、pnpm + Turborepo の組み合わせで十分です。より重厚な機能（バージョン管理、changelog 生成）が必要な場合は、Changesets を追加することもできます。
