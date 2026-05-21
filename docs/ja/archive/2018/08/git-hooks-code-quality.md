---
title: "Git Hooksとコード品質の自動化"
date: 2018-08-21 10:12:35
tags:
  - Git
readingTime: 2
description: "コミット前に毎回手動でlintやテストを実行するのは忘れやすいです。Git Hooksを使ってこれらのチェックを自動化し、コミット時に自動実行させましょう。"
wordCount: 492
---

コミット前に毎回手動でlintやテストを実行するのは忘れやすいです。Git Hooksを使ってこれらのチェックを自動化し、コミット時に自動実行させましょう。

## Git Hooksとは

Gitは特定のイベント（コミット、プッシュなど）の前後に対応するスクリプトをトリガーします。これをHookと呼びます。

```
pre-commit：git commit前にトリガー（最もよく使う）
commit-msg：コミットメッセージのフォーマットを確認
pre-push：git push前にトリガー
post-merge：git pull/merge後にトリガー（npm installを自動実行できる）
```

## Husky：Git Hooksの管理

`.git/hooks/pre-commit`スクリプトを手書きするとチームで共有しにくいです。Huskyを使いましょう：

```bash
npm install husky --save-dev
```

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint",
      "commit-msg": "node scripts/verify-commit-msg.js"
    }
  }
}
```

## lint-staged：ステージングエリアのファイルのみチェック

コミットのたびにプロジェクト全体にlintを実行すると、大きなプロジェクトでは遅くなります。`lint-staged`は今回のコミットのファイルだけを処理します：

```bash
npm install lint-staged --save-dev
```

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,vue}": ["eslint --fix", "git add"],
    "*.{css,scss}": ["stylelint --fix", "git add"],
    "*.{js,vue,css,scss,md,json}": ["prettier --write", "git add"]
  }
}
```

実行フロー：

1. `git commit`が`pre-commit`フックをトリガー
2. `lint-staged`がステージングエリアのファイルを見つける
3. それらのファイルにのみESLintとPrettierを実行
4. エラーがあればコミット失敗。自動修正された場合は修正後のファイルを再追加

## commit-msg：コミットメッセージの標準化

```javascript
// scripts/verify-commit-msg.js
const fs = require("fs");
const msg = fs.readFileSync(process.env.HUSKY_GIT_PARAMS, "utf-8").trim();

// Angularのコミット規約
const commitReg =
  /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}/;

if (!commitReg.test(msg)) {
  console.error("コミットメッセージが規約に合っていません！");
  console.error("正しいフォーマット：feat(scope): 説明");
  console.error("タイプ：feat|fix|docs|style|refactor|test|chore");
  process.exit(1);
}
```

または`commitlint`を使う（より成熟したソリューション）：

```bash
npm install @commitlint/cli @commitlint/config-conventional --save-dev
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

```json
{
  "husky": {
    "hooks": {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

## post-merge：新しい依存関係の自動インストール

```bash
# .git/hooks/post-merge（またはHuskyを使う）
#!/bin/bash
# package.jsonに変更があれば自動でnpm installを実行
changed_files=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)
if echo "$changed_files" | grep -q "package.json"; then
  echo "package.jsonが変更されました。npm installを実行します..."
  npm install
fi
```

## チームへの設定の共有

```json
// package.json
{
  "scripts": {
    "prepare": "husky install" // npm install後にHuskyを自動で有効化
  }
}
```

チームの誰が`npm install`してもGit Hooksが自動的に有効になります。

## まとめ

- Husky：Git Hook設定をpackage.jsonに置いてチームで簡単に共有
- lint-staged：今回のコミットのファイルのみをチェック。高速
- commitlint：コミットメッセージを標準化。changelog生成に便利
- `prepare`スクリプト：`npm install`後にHuskyを自動初期化
