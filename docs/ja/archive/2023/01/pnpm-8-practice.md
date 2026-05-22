---
title: "pnpm 8：より速く、より厳格なパッケージ管理実践"
date: 2023-01-25 14:31:47
tags:
  - フロントエンド
readingTime: 3
description: "pnpm 8 がリリースされました。チームのデフォルトパッケージマネージャーとして、アップグレード後に全面的なパフォーマンス比較テストを実施しました。"
wordCount: 620
---

pnpm 8がリリースされました。当チームのデフォルトパッケージマネージャーとして、アップグレード後に全面的なパフォーマンス比較テストを実施しました。

## コアの改善

### 更快的安装速度

pnpm 8 は解決とリンクの段階で最適化が行われ、大規模な monorepo で顕著な改善が見られます：

```bash
# 当プロジェクトの実測（1200+ 依存関係、monorepo に 15 パッケージ）
# コールドインストール（clean install）
npm:   89s
yarn:  62s
pnpm7: 38s
pnpm8: 24s

# ホットインストール（lockfile あり、node_modules は削除）
pnpm8: 11s
```

### Node.js 18+ 要求

pnpm 8 は最低 Node.js 18 を要求しますが、これは正しい判断です。Node 16 はすでに EME（メンテナンス期間終了）であり、古いバージョンのサポートを放棄することで、より良いパフォーマンスを得られます。

### 更严格的依赖处理

默认行为变化：

```jsonc
// .npmrc
// pnpm 8 はデフォルトで strict-peer-dependencies = true
// peer dependencies を自動インストールしなくなる
```

これは破壊的変更のように見えますが、実は良いことです。以前の自動インストールでは peer dependencies のバージョン競合が頻繁に発生していました。

## Monorepo の実践

### workspace 协议

```jsonc
// packages/ui/package.json
{
  "name": "@company/ui",
  "dependencies": {
    "@company/utils": "workspace:*",
    "@company/types": "workspace:^"
  }
}
```

`workspace:*` は常にローカルバージョンを使用し、`workspace:^` は公開時に `^x.y.z` に変換されます。これは pnpm がネイティブでサポートしており、追加設定は不要です。

### 高效的依赖提升

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// .npmrc
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

`public-hoist-pattern` は、どの依存関係をルートにホイストするかを制御します。npm/yarn とは異なり、pnpm は明示的に指定したパッケージのみをホイストし、ゴースト依存関係を回避します。

### 过滤命令

```bash
# apps ディレクトリ以下でのみビルドを実行
pnpm --filter="./apps/*" build

# @company/ui とその依存関係のみをビルド
pnpm --filter "@company/ui..." build

# @company/utils に依存するすべてのパッケージをビルド
pnpm --filter "...@company/utils" build
```

## Turborepo との連携

```jsonc
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "test/**"]
    }
  }
}
```

pnpm workspace + Turborepo は現在の monorepo 最適な組み合わせです。pnpm が依存関係を管理し、Turbo がタスクのオーケストレーションとキャッシュを担当します。

## 移行時の注意点

```bash
# pnpm 7 からのアップグレード
pnpm -v  # 8.x であることを確認

# lockfile を再生成
pnpm install --no-frozen-lockfile

# peer dependency の警告を確認
pnpm install 2>&1 | grep "peer dep"
```

## まとめ

- pnpm 8 のインストール速度は約35-40%向上（大規模 monorepo）
- デフォルトで厳格な peer dependency 処理により、バージョン競合が減少
- Node.js 18+ 必須で、モダンなランタイムに対応
- workspace プロトコルとフィルターコマンドで monorepo 管理がより効率的に
- Turborepo との組み合わせが、現在のフロントエンド monorepo の最適解