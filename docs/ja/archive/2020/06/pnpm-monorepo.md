---
title: "pnpm workspace を使ったMonorepo管理"
date: 2020-06-23 15:01:17
tags:
  - Node.js
readingTime: 2
description: "团队有 5 个前端项目，共用一套组件库和工具函数。之前组件库改动需要手动发布、各项目手动升级，效率太低。用 pnpm workspace 搭建 Monorepo 后，一切都变简单了。"
wordCount: 330
---

チームには 5 つのフロントエンドプロジェクトがあり、共通のコンポーネントライブラリとユーティリティ関数を共有している。以前はコンポーネントライブラリを変更するたびに手動で公開し、各プロジェクトも手動でアップグレードしていたため、効率が悪かった。pnpm workspace で Monorepo を組んだことで、すべてが格段に楽になった。

## なぜpnpmを選ぶのか

```markdown
npm/yarn の問題点：
- node_modules の幽霊依存（未宣言のパッケージにもアクセスできてしまう）
- ディスク占有量が大きい（プロジェクトごとに丸ごとコピーされる）
- フラット化インストールによるバージョン競合

pnpm のメリット：
- 厳格な依存関係：package.json で宣言した依存だけにアクセス可能
- ハードリンク + シンボリックリンク：ディスク占有量を大幅に削減
- 組み込みの workspace サポート：Monorepo に lerna は不要
```

```bash
# pnpm をインストールする
npm install -g pnpm

# 確認
pnpm --version
```

## プロジェクト構造

```
monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── components/        # コンポーネントライブラリ
│   │   ├── package.json   # @company/components
│   │   └── src/
│   ├── utils/             # ユーティリティ関数ライブラリ
│   │   ├── package.json   # @company/utils
│   │   └── src/
│   └── types/             # 型定義
│       ├── package.json   # @company/types
│       └── src/
├── apps/
│   ├── admin/             # 管理画面
│   │   ├── package.json
│   │   └── src/
│   └── portal/            # ポータル
│       ├── package.json
│       └── src/
```

## 配置文件

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```json
// ルートの package.json
{
  "name": "monorepo",
  "private": true,
  "scripts": {
    "dev:admin": "pnpm --filter @company/admin dev",
    "dev:portal": "pnpm --filter @company/portal dev",
    "build:all": "pnpm -r run build",
    "test:all": "pnpm -r run test",
    "lint:all": "pnpm -r run lint"
  }
}
```

```json
// packages/utils/package.json
{
  "name": "@company/utils",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "rollup -c"
  }
}
```

## パッケージ間の相互参照

```json
// apps/admin/package.json
{
  "name": "@company/admin",
  "dependencies": {
    "@company/components": "workspace:*",
    "@company/utils": "workspace:*"
  }
}
```

```typescript
// apps/admin/src/App.vue
// そのまま import すれば、pnpm がリンクを自動で解決する
import { Button, Input } from '@company/components';
import { formatCurrency } from '@company/utils';

// packages/components を変更すると、admin 側にすぐ反映される
// 手動での公開やアップグレードは不要
```

## 常用命令

```bash
# すべての依存をインストール
pnpm install

# 指定したパッケージでコマンドを実行
pnpm --filter @company/admin run dev

# すべてのパッケージでコマンドを実行
pnpm -r run build

# 変更のあったパッケージのみで実行
pnpm -r --changed run build

# 指定したパッケージに依存を追加
pnpm --filter @company/admin add axios

# 内部パッケージの依存を追加
pnpm --filter @company/admin add @company/utils@workspace:*

# 開発依存を追加
pnpm --filter @company/admin add -D typescript
```

## 和 lerna 对比

```bash
# lerna + yarn の場合：
# 1. lerna.json
# 2. yarn workspaces の設定
# 3. lerna bootstrap
# 4. lerna publish

# pnpm workspace の場合：
# 1. pnpm-workspace.yaml
# 2. pnpm install
# 3. 公開は pnpm publish または changeset を利用
```

```bash
# changeset でバージョン管理と公開を行う
pnpm add -Dw @changesets/cli

# 初期化
pnpm changeset init

# 変更を記録
pnpm changeset

# バージョンを上げる
pnpm changeset version

# 公開
pnpm changeset publish
```

## 选择性构建

```json
// ルートの package.json
{
  "scripts": {
    "build:changed": "pnpm -r --changed run build",
    "build:components": "pnpm --filter @company/components run build",
    "build:utils": "pnpm --filter @company/utils run build"
  }
}
```

```yaml
# .github/workflows/ci.yml
# CI では変更のあったパッケージだけをビルドする
- name: Build changed packages
  run: pnpm -r --changed run build
```

## まとめ

- pnpm workspace は Monorepo を管理するうえで最も軽量な選択肢で、追加のツールは不要だ
- `workspace:*` で内部依存を宣言すれば、変更が即座に反映される
- 厳格な依存関係の管理により、幽霊依存（phantom dependency）の問題を防げる
- ハードリンクによってディスク容量を節約でき、インストールも高速になる
- changeset と組み合わせれば、バージョン管理と公開を自動化できる
