---
title: "Monorepo 実践入門：Lerna でマルチパッケージプロジェクトを管理する"
date: 2018-10-23 17:02:40
tags:
  - マイクロフロントエンド
  - エンジニアリング
readingTime: 3
description: "会社には互いに依存する複数のプロジェクトがあり、マルチリポジトリで管理していたため、ローカル統合とバージョン同期が非常に面倒でした。Monorepo を調査したところ、Lerna が現在最もメインストリームなソリューションでした。"
---

会社には互いに依存する複数のプロジェクトがあり、マルチリポジトリで管理していたため、ローカル統合とバージョン同期が非常に面倒でした。Monorepo を調査したところ、Lerna が現在最もメインストリームなソリューションでした。

## Monorepo vs Multirepo

**Multirepo（マルチリポジトリ）**：プロジェクト/パッケージごとに1つの git リポジトリ

- メリット：責任が明確、互いに干渉しない
- デメリット：クロスパッケージの変更に複数の PR が必要、ローカル統合が複雑、バージョン管理が困難

**Monorepo（シングルリポジトリ）**：複数のパッケージを1つの git リポジトリで管理

- メリット：アトミックコミット、統一バージョン管理、ローカル統合が簡単
- デメリット：リポジトリが大きくなる、CI の設定が増える

## Lerna の基本

```bash
npm install -g lerna
npx lerna init
```

生成される構造：

```
my-monorepo/
├── packages/
│   ├── components/       # @myorg/components
│   ├── utils/            # @myorg/utils
│   └── admin/            # @myorg/admin（上記2つに依存）
├── lerna.json
└── package.json
```

```json
// lerna.json
{
  "version": "independent", // 各パッケージが独自バージョンを持つ
  "npmClient": "npm",
  "packages": ["packages/*"]
}
```

## よく使うコマンド

```bash
# 新しいパッケージを作成
npx lerna create @myorg/utils packages/utils

# 特定のパッケージに依存関係をインストール
npx lerna add lodash --scope=@myorg/components

# パッケージ間の依存関係（シムリンクを使用、公開不要）
npx lerna add @myorg/utils --scope=@myorg/admin

# 全パッケージでコマンドを実行
npx lerna run build          # 全パッケージで npm run build を実行
npx lerna run test           # 全パッケージで npm run test を実行
npx lerna run build --scope=@myorg/components  # 特定のパッケージのみ実行

# 公開
npx lerna publish
# 自動：変更されたパッケージを検出 → バージョンアップ → 依存関係を更新 → npm に公開 → git タグを付ける
```

## Yarn Workspaces との組み合わせ

Lerna + Yarn Workspaces は現在最も人気のある組み合わせです：

```json
// ルートの package.json
{
  "private": true,
  "workspaces": ["packages/*"]
}

// lerna.json
{
  "npmClient": "yarn",
  "useWorkspaces": true
}
```

Yarn Workspaces が依存関係のホイスティング（共通の依存関係をルートに引き上げる）を担当し、Lerna がバージョン公開を担当します。

```bash
yarn install  # 全パッケージの依存関係を一度にインストール、共通の依存関係は共有
```

## 実際の構造の例

```
packages/
├── ui/
│   ├── src/
│   │   ├── Button/
│   │   ├── Input/
│   │   └── index.ts
│   └── package.json
│       → { "name": "@myorg/ui", "version": "1.0.0" }
│
├── utils/
│   ├── src/
│   │   ├── format.ts
│   │   └── request.ts
│   └── package.json
│       → { "name": "@myorg/utils", "version": "1.0.0" }
│
└── admin-app/
    ├── src/
    └── package.json
        → { "dependencies": {
              "@myorg/ui": "^1.0.0",      // ローカルパッケージ、シムリンク
              "@myorg/utils": "^1.0.0"    // ローカルパッケージ、シムリンク
            } }
```

## 課題

- リポジトリが大きくなると CI 時間が長くなる（変更されたパッケージのみに対して CI を実行する必要がある）
- IDE のパフォーマンスが低下する可能性がある（node_modules が非常に大きい）
- 各パッケージにビルドツールを設定する必要がある

Lerna 6.x 以降、これらの問題に対してより良いサポートが追加されました（影響範囲検出、タスクパイプライン）。

## まとめ

- Monorepo は相互依存のあるマルチパッケージプロジェクトに適している
- Lerna がバージョン公開を担当し、Yarn Workspaces が依存関係管理を担当する
- `lerna run build` はすべてのパッケージをトポロジー順にビルドする
- ローカルパッケージはシムリンクで互いに参照するため、npm に公開せずにローカル開発できる
