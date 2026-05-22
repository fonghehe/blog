---
title: "Turborepo 初見：高性能 Monorepo ビルド"
date: 2021-11-08 15:28:08
tags:
  - エンジニアリング

readingTime: 3
description: "Vercel が Turborepo を買収しオープンソース化しました。これは Go 言語で書かれた高性能 Monorepo ビルドツールです。1週間試用し、Lerna や pnpm workspace と比較してみました。"
wordCount: 670
---

Vercel が Turborepo を買収しオープンソース化しました。これは Go 言語で書かれた高性能 Monorepo ビルドツールです。1週間試用し、Lerna や pnpm workspace と比較してみました。

## Monorepo の課題

pnpm workspace で monorepo プロジェクトを管理する場合、パッケージ管理に問題はありませんが、ビルドのオーケストレーションが非常に原始的です：

```bash
# pnpm workspace でのビルド方法
pnpm run build --filter=packages/core
pnpm run build --filter=packages/utils
pnpm run build --filter=packages/ui
pnpm run build --filter=apps/web

# 問題点：
# 1. 手動でビルド順序を決める
# 2. キャッシュなし（毎回フルビルド）
# 3. CI ではさらに遅い（ローカルキャッシュなし）
```

## Turborepo が解決すること

- **ビルドキャッシュ**：同じ入力は再ビルドしない（ローカル＋リモートキャッシュ）
- **並列スケジューリング**：依存グラフを自動分析し、依存のないパッケージを並列ビルド
- **インクリメンタルビルド**：変更のあるパッケージとそのダウンストリーム依存のみをビルド

## 基本設定

```bash
# インストール
npm install -D turbo
```

```jsonc
// turbo.json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],       // 依存パッケージを先にビルド
      "outputs": ["dist/**"]          // これらの成果物をキャッシュ
    },
    "dev": {
      "cache": false,                 // dev はキャッシュしない（継続実行）
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

```jsonc
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "lint": "eslint src/"
  }
}

// apps/web/package.json
{
  "name": "@myorg/web",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:*"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "lint": "eslint src/"
  }
}
```

## 実行

```bash
# すべてのパッケージをビルド（依存グラフを自動分析し、並列実行）
turbo run build

# 特定のパッケージとその依存のみをビルド
turbo run build --filter=@myorg/web

# すべての dev を並列実行
turbo run dev --parallel

# すべての lint を実行（依存関係なし、完全並列）
turbo run lint
```

## キャッシュメカニズム

```bash
# 初回ビルド
turbo run build
# packages/core:   build (2.3s)
# packages/utils:  build (1.1s)
# packages/ui:     build (3.5s)
# apps/web:        build (5.2s)

# 変更なし、2回目のビルド
turbo run build
# packages/core:   build >>> FULL TURBO (cached, 0.0s)
# packages/utils:  build >>> FULL TURBO (cached, 0.0s)
# packages/ui:     build >>> FULL TURBO (cached, 0.0s)
# apps/web:        build >>> FULL TURBO (cached, 0.0s)

# utils のみ変更、3回目のビルド
turbo run build
# packages/core:   build >>> FULL TURBO (cached, 0.0s)    # 変更なし
# packages/utils:  build (1.2s)                             # 再ビルド
# packages/ui:     build (3.4s)                             # utils に依存、再ビルド
# apps/web:        build (5.1s)                             # ui に依存、再ビルド
```

キャッシュキーは以下に基づきます：ソースファイルの内容 + 環境変数 + ロックファイル + package.json scripts。

## リモートキャッシュ（CIシナリオ）

```bash
# Vercel にログイン（リモートキャッシュは無料）
npx turbo login

# リモートキャッシュにリンク
npx turbo link

# 以後、turbo run build は自動でキャッシュを Vercel に同期
# ローカルで一度ビルド → CI は直接キャッシュを使用
```

CI 設定例：

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 6
      - uses: actions/setup-node@v3
        with:
          node-version: 16
          cache: 'pnpm'

      - run: pnpm install

      # Turborepo は自動でリモートキャッシュを使用します
      # ローカルでビルド済みの場合、CI は直接キャッシュを使用します
      - run: pnpm turbo run build test lint
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

## Lerna との比較

| 特性 | Lerna | Turborepo |
|------|-------|-----------|
| ビルドオーケストレーション | topo ソート依存 | 自動依存グラフ＋並列 |
| キャッシュ | なし | ローカル＋リモート |
| インクリメンタルビルド | なし | 自動 |
| パッケージ公開 | あり（コア機能） | なし（公開は対象外） |
| 設定の複雑さ | 中程度 | 最小限 |

Lerna は公開を担当し、Turborepo はビルドを担当します。併用が可能です。

## pnpm workspace との連携

```bash
# pnpm が依存関係を管理し、Turborepo がビルドのオーケストレーションを担当
# これは現在最も推奨される組み合わせです

# package.json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.0.0",
    "pnpm": "7.x"  // pnpm は workspace プロトコルで依存関係を管理
  }
}
```

## まとめ

- Turborepo は Monorepo のビルドオーケストレーションとキャッシュの問題を解決しますが、パッケージ公開の問題は解決しません
- ローカル＋リモートキャッシュが最大のセールスポイントで、CI のビルド時間を分単位から秒単位に短縮できます
- pnpm workspace との連携が最適なソリューションです：pnpm が依存関係を管理し、Turborepo がビルドを管理します
- 設定は最小限（turbo.json 1つ）で、学習コストが低いです
- 3つ以上のパッケージがある Monorepo プロジェクトに適しています；パッケージが少ない場合は pnpm workspace で十分です
