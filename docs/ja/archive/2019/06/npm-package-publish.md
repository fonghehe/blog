---
title: "npmパッケージを公開する完全なフロー"
date: 2019-06-26 09:37:41
tags:
  - Node.js
readingTime: 1
description: "ユーティリティを書いて、すべてのプロジェクトにコピー&ペーストするのは非効率です。十分に安定したら、npmに公開して他のパッケージと同様にインストールできるようにしましょう。本記事ではプロジェクト初期化から公開までの完全なワークフローを説明します。"
wordCount: 315
---

ユーティリティを書いて、すべてのプロジェクトにコピー&ペーストするのは非効率です。十分に安定したら、npmに公開して他のパッケージと同様にインストールできるようにしましょう。本記事ではプロジェクト初期化から公開までの完全なワークフローを説明します。

## プロジェクト初期化

```bash
mkdir my-utils && cd my-utils
npm init
# またはすべてデフォルトのショートカット:
npm init -y
```

## package.jsonの重要なフィールド

```json
{
  "name": "@yourname/my-utils", // 名前の衝突を避けるためのスコープパッケージ
  "version": "1.0.0",
  "description": "ユーティリティ関数のコレクション",
  "main": "dist/index.cjs.js", // CommonJSエントリ（Node.js/Webpack）
  "module": "dist/index.esm.js", // ES Moduleエントリ（バンドラーのツリーシェイキング）
  "types": "dist/index.d.ts", // TypeScriptの型定義
  "files": [
    // 公開時に含めるファイル
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "rollup -c",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test" // 公開前に自動実行
  },
  "keywords": ["utils", "helpers"],
  "license": "MIT",
  "devDependencies": {
    "rollup": "^1.0.0",
    "jest": "^24.0.0"
  }
}
```

## filesフィールドと.npmignore

公開するファイルを制御する2つの方法：

```
# .npmignore（.gitignoreと同様、npm用）
src/
tests/
*.test.js
.eslintrc.js
rollup.config.js
```

**推奨：package.jsonの`files`フィールドを使用** — より明示的です。リストにあるものだけが公開されます。`.npmignore`はブロックリストで、意図しないファイルが含まれる可能性があります。

## semverによるバージョン管理

```bash
# 1.0.0 → 1.0.1 (patch: バグ修正)
npm version patch

# 1.0.0 → 1.1.0 (minor: 新機能、後方互換性あり)
npm version minor

# 1.0.0 → 2.0.0 (major: 破壊的変更)
npm version major
```

## 公開

```bash
# まずログイン
npm login

# パブリックレジストリに公開
npm publish --access public  # スコープパッケージには--access publicが必要

# ベータ版を公開
npm publish --tag beta
# ベータをインストール: npm install @yourname/my-utils@beta
```

## パッケージの確認

```bash
# 公開されるファイルをプレビュー（ドライラン）
npm pack --dry-run

# またはverdaccioでローカルレジストリに公開してテスト
```

良いオープンソースパッケージには必要なもの：明確なREADME、TypeScriptの型定義、変更履歴、テストカバレッジ。まずREADMEから始めましょう——ユーザーが最初に見るものです。
