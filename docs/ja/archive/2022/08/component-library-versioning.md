---
title: "コンポーネントライブラリのバージョン管理：Monorepo におけるリリース戦略"
date: 2022-08-23 14:31:47
tags:
  - フロントエンド
readingTime: 3
description: "pnpm + Turborepo の monorepo でコンポーネントライブラリのバージョン管理を行うのは現実的な課題です。いつ patch をリリースし、いつ minor をリリースし、どう changelog を生成し、breaking change をどう扱うか。この記事では私たちのチームの実践を紹介します。"
wordCount: 535
---

pnpm + Turborepo の monorepo でコンポーネントライブラリのバージョンを管理するのは実際的な問題です。いつ patch をリリースし、いつ minor をリリースし、どのように changelog を生成し、breaking change をどう扱うか？この記事では私たちのチームの実践を紹介します。

## バージョン戦略：SemVer

```json
// packages/ui-components/package.json
{
  "name": "@mono/ui-components",
  "version": "1.5.2",
  "publishConfig": {
    "access": "public"
  }
}
```

ルール：
- **patch** (1.5.2 -> 1.5.3)：バグ修正、API変更なし
- **minor** (1.5.2 -> 1.6.0)：新機能追加、後方互換
- **major** (1.5.2 -> 2.0.0)：破壊的変更

## Changesets：自動化バージョン管理

```bash
pnpm add -D -w @changesets/cli
```

```bash
# 初始化
pnpm changeset init
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@2.3.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [
    ["@mono/ui-components", "@mono/ui-docs"]
  ],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@mono/eslint-config", "@mono/ts-config"]
}
```

`linked` はこれら2つのパッケージが一緒にリリースされることを意味します——コンポーネントライブラリの更新時にドキュメントサイトもバージョンを上げます。

## 日々の開発フロー

```bash
# 開発
git checkout -b feat/add-date-picker

# ... コードを書く ...

# コミット前にchangesetを作成
pnpm changeset

# インタラクティブ選択：
# ? Which packages have changed?
#   ◉ @mono/ui-components
#   ◯ @mono/utils
#   ◯ @mono/admin
# ? Is this a major/minor/patch?
#   ◯ major
#   ◉ minor
#   ◯ patch
# ? Summary: DatePicker コンポーネントを追加
```

生成されるファイル `.changeset/xxxx-add-date-picker.md`：

```markdown
---
"@mono/ui-components": minor
---

新增 DatePicker 组件
```

このファイルはPRと一緒に提出されます。

## CI 自動リリース

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2
        with:
          version: 7

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm turbo run build

      - name: Test
        run: pnpm turbo run test

      # 创建版本 PR 或直接发布
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

フロー：PRをmainにマージ -> Changesetsがchangesetファイルを検出 -> 自動的に「Version Packages」PRを作成 -> マージ後に自動的にnpmに公開。

## BREAKING CHANGE の処理

```markdown
---
"@mono/ui-components": major
---

BREAKING CHANGE: Button コンポーネントの variant プロパティ値を文字列から列挙型に変更

- `variant="primary"` を `variant={ButtonVariant.Primary}` に変更
- `variant="danger"` を `variant={ButtonVariant.Danger}` に変更
- `variant="default"` を削除し、`variant={ButtonVariant.Outline}` に変更
```

アップグレードガイドは別途移行ドキュメントを作成し、changesetには簡潔に記載します。

## 依存関係のバージョン同期

```json
// packages/ui-components/package.json
{
  "name": "@mono/ui-components",
  "version": "1.5.2",
  "dependencies": {
    "@mono/utils": "workspace:*"
  }
}

// apps/admin/package.json
{
  "dependencies": {
    "@mono/ui-components": "workspace:*",
    "@mono/utils": "workspace:*"
  }
}
```

`workspace:*` は常にローカルバージョンを使用することを保証します。公開時に Changesets が自動的に実際のバージョン番号に置き換えます。

## Changelog 生成

```markdown
# @mono/ui-components

## 1.6.0

### Minor Changes

- abc123: 新增 DatePicker 组件
- def456: Button 新增 loading 状态

### Patch Changes

- ghi789: 修复 Modal 关闭后焦点未恢复的问题
- Updated dependencies
  - @mono/utils@1.3.1
```

## バージョン管理の哲学

```typescript
// 私たちの約束：

// ツールパッケージ：厳格な SemVer
"@mono/utils": "1.2.3"      // patch/minor/major

// コンポーネントライブラリ：厳格な SemVer + CHANGELOG
"@mono/ui-components": "2.1.0"

// アプリケーション：公開不要、内部バージョン
"admin": "0.0.0"             // 常に 0.0.0

// 設定パッケージ：patch アップグレードで十分
"@mono/eslint-config": "1.0.5"
```

## Turborepo との連携

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "version": {
      "cache": false
    },
    "publish": {
      "cache": false,
      "dependsOn": ["build"]
    }
  }
}
```

## まとめ

Changesets は現在の monorepo バージョン管理の最良のソリューションです。「いつリリースするか」と「どのバージョンをリリースするか」の問題を自動化します。CIと組み合わせることで、開発者はPR内でchangesetを作成するだけで、残りはすべて自動化されます。