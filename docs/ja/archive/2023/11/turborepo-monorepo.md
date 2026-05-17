---
title: "Turborepo：フロントエンド Monorepo のタスクオーケストレーションエンジン"
date: 2023-11-25 14:31:00
tags:
  - フロントエンドエンジニアリング
readingTime: 3
description: "Turborepo が成熟しました。15パッケージの monorepo で半年以上使用した実践経験を共有します。"
---

Turborepo が成熟しました。15パッケージの monorepo で半年以上使用した実践経験を共有します。

## なぜ Turborepo を選ぶのか

Monorepo ツール選定：

- **Nx**：最も機能が豊富ですが、学習曲線が急峻で非 JS プロジェクトへの傾向があります
- **Lerna**：バージョン管理が主で、タスクオーケストレーション能力が弱い
- **Turborepo**：タスクオーケストレーションとキャッシュに特化、習得が簡単、pnpm との相性が良い

私たちのニーズはシンプルです：タスクオーケストレーション + キャッシュ + 並列実行。Nx のすべての機能は必要ありません。

## 基本設定

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts"]
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

- `dependsOn: ["^build"]`：すべての依存パッケージを先にビルド（`^` は依存関係を示す）
- `outputs`：キャッシュする出力ファイルを定義
- `inputs`：キャッシュに影響する入力ファイルを定義（キャッシュ無効化を正確にコントロール）
- `cache: false`：dev モードではキャッシュしない

## 動作原理

```
turbo build

1. 解析所有包的 package.json，构建依赖图
2. 按拓扑排序确定构建顺序
3. 并行执行没有依赖关系的任务
4. 每个任务的输入（源码 + 依赖 hash + 环境变量）生成 hash
5. 如果 hash 命中远程缓存，跳过执行，直接恢复 outputs
6. 执行结果上传到远程缓存
```

## 実際の効果

```
# 首次构建（无缓存）
turbo build:  45s

# 只改了一个包的代码
turbo build:  3s  （其余 14 个包命中缓存）

# CI 中 PR 重复构建
turbo build:  <1s （全部命中远程缓存）
```

## リモートキャッシュ

```bash
# 使用 Vercel Remote Cache（免费额度够用）
npx turbo login
npx turbo link

# 或者自建远程缓存
# 使用 turbo-server 或第三方方案
```

リモートキャッシュにより CI とローカルがビルドキャッシュを共有できます。同僚がすでにビルドしたコードは、プルダウンすれば直接キャッシュを利用できます。

## pnpm Workspace との連携

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// package.json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --parallel"
  }
}
```

pnpm が依存関係の解決とインストールを担当し、Turbo がタスク実行とキャッシュを担当します。職責が明確です。

## フィルタリングと選択的実行

```bash
# 只构建某个包及其依赖
turbo run build --filter=@company/ui

# 只构建有变更的包
turbo run build --filter=[HEAD^1]

# 排除某些包
turbo run build --filter='!@company/docs'

# 只构建 apps 目录下的包
turbo run build --filter='./apps/*'
```

## グローバル依存とキャッシュ無効化

```jsonc
// turbo.json
{
  "globalDependencies": [
    // 这些文件变化会导致所有任务缓存失效
    ".env",
    "tsconfig.base.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      // 精确到每个任务的输入文件
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    }
  }
}
```

`globalDependencies` は非常に重要です。`tsconfig.base.json` の設定を忘れると、ベース設定を変更してもキャッシュが期限切れにならず、不思議なビルド問題が発生します。

## まとめ

- Turborepo は一つのことに集中します：タスクオーケストレーション + キャッシュ、そして非常にうまくやっています
- pnpm workspace と自然に連携し、それぞれが役割を果たします
- リモートキャッシュはキラー機能で、CI ビルド時間を秒単位まで削減できます
- 設定がシンプルで、`turbo.json` 一ファイルで完結
- Nx のような学習コストが不要で、ほとんどのフロントエンド monorepo に適しています