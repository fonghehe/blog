---
title: "pnpm Workspace：node_modules 地獄から逃れる Monorepo ソリューション"
date: 2022-01-10 11:13:23
tags:
  - フロントエンドエンジニアリング
readingTime: 3
description: "チームは複数のフロントエンドプロジェクトを pnpm workspace に移行して半年が経ちました。ディスク使用量が60%削減され、インストール速度が顕著に向上し、ファントム依存関係の問題が完全に解決されました。この記事では移行プロセスを記録します。"
wordCount: 775
---

チームは複数のフロントエンドプロジェクトを pnpm workspace に移行して半年が経ちました。ディスク使用量が60%削減され、インストール速度が顕著に向上し、ファントム依存関係の問題が完全に解決されました。この記事では移行プロセスを記録します。

## なぜ pnpm を選ぶのか

npm と yarn の node_modules はフラット構造であり、依存関係のホイスティングが2つの問題をもたらします：

1. **ファントム依存関係**：package.json に宣言されていないパッケージをインポートできてしまいます（トップレベルにホイストされるため）
2. **ディスクの無駄**：異なるプロジェクトがそれぞれ完全な node_modules コピーを維持します

pnpm はハードリンクとコンテンツアドレス可能なストレージを使用してこれらの問題を解決します：

```bash
# 全局安装 pnpm
npm install -g pnpm@7

# 查看全局存储
pnpm store path
# ~/.local/share/pnpm/store/v3
```

## プロジェクト構造

私たちのフロントエンド monorepo の構造：

```
frontend-monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── ui-components/        # 组件库
│   ├── utils/                # 工具函数
│   ├── eslint-config/        # ESLint 共享配置
│   └── ts-config/            # TypeScript 共享配置
├── apps/
│   ├── admin/                # 后台管理
│   ├── h5/                   # 移动端 H5
│   └── docs/                 # 文档站
└── pnpm-lock.yaml
```

## pnpm-workspace.yaml の設定

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

ルートディレクトリの `package.json`：

```json
{
  "name": "frontend-monorepo",
  "private": true,
  "scripts": {
    "dev:admin": "pnpm --filter admin dev",
    "dev:h5": "pnpm --filter h5 dev",
    "build:all": "pnpm -r build",
    "test:all": "pnpm -r test",
    "lint:all": "pnpm -r lint"
  },
  "engines": {
    "node": ">=16"
  }
}
```

## ワークスペース依存関係管理

```bash
# 给 admin 项目安装 ui-components（workspace 协议）
pnpm --filter admin add ui-components@workspace:*

# 给 admin 安装 lodash（只装在 admin）
pnpm --filter admin add lodash

# 给所有项目安装 typescript（作为 devDependencies）
pnpm -r add -D typescript

# 给根目录安装全局开发工具
pnpm add -D -w husky lint-staged
```

インストール後、`admin/package.json` の依存関係は以下のようになる：

```json
{
  "dependencies": {
    "ui-components": "workspace:*",
    "lodash": "^4.17.21"
  }
}
```

`workspace:*` は常にローカルバージョンを使用することを意味し、公開時に pnpm が自動的に実際のバージョン番号に置き換える。

## .npmrc の設定

```ini
# 使用严格模式，不能访问未声明的依赖
strict-peer-dependencies=false

# 在项目级别创建 node_modules，保持兼容性
node-linker=hoisted

# 使用公共的 lockfile
shared-workspace-lockfile=true

# 自动安装 peerDependencies
auto-install-peers=false
```

`node-linker` には3つのオプションがある：
- `isolated`（デフォルト）：厳密なシンボリックリンク構造、互換性は最も低いが最も安全
- `hoisted`：npm/yarn に似たフラット構造、互換性が最も高い
- `hoisted`：妥協案

私たちが `hoisted` を選んだのは、一部の古い依存関係が厳密な node_modules 構造をサポートしていないためだ。

## フィルターの活用

```bash
# 只执行 admin 及其依赖的 build
pnpm --filter admin... build

# 执行 ui-components 被依赖的所有项目
pnpm --filter '...ui-components' build

# 结合使用：build 受影响的项目
pnpm --filter '...ui-components' --filter 'admin...' build

# 排除某些包
pnpm -r --no-filter docs test
```

これは CI で特に有用だ——変更があったプロジェクトだけを build・test できる。

## よくある落とし穴

### 1. peerDependencies 警告

```json
// packages/ui-components/package.json
{
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  },
  "peerDependenciesMeta": {
    "react": { "optional": false },
    "react-dom": { "optional": false }
  }
}
```

pnpm は peerDependencies に対して厳密で、各消費側は明示的に react をインストールする必要がある。

### 2. Workspace プロトコルのバージョン範囲

```json
"ui-components": "workspace:^"   // 发布时替换为 ^1.2.3
"ui-components": "workspace:*"   // 发布时替换为 1.2.3（精确版本）
"ui-components": "workspace:~"   // 发布时替换为 ~1.2.3
```

### 3. スクリプトの実行順序

```bash
# 按拓扑排序执行（先执行依赖，再执行消费方）
pnpm -r --workspace-concurrency=1 build

# 并行执行（更快但要确保 build 之间没有依赖）
pnpm -r build
```

## 移行手順のまとめ

```bash
# 1. 全局安装 pnpm
npm install -g pnpm@7

# 2. 删除旧的 lock 文件和 node_modules
rm -rf node_modules package-lock.json yarn.lock

# 3. 初始化 workspace
echo "packages:
  - 'packages/*'
  - 'apps/*'" > pnpm-workspace.yaml

# 4. 安装依赖
pnpm install

# 5. 用 pnpm filter 替换原来的脚本
```

## まとめ

pnpm workspace はディスク効率と依存関係の分離において最適なバランスを実現している。フロントエンド monorepo にとって、現時点で最も実用的な選択肢だ。次回は Turborepo を使ったビルドオーケストレーションについて書き、pnpm と組み合わせた完全な monorepo ツールチェーンを紹介する予定だ。