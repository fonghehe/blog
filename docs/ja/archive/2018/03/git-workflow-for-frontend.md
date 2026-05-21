---
title: "フロントエンドエンジニアリング：Git ワークフロー規約"
date: 2018-03-27 10:12:36
tags:
  - エンジニアリング
readingTime: 3
description: "チームコラボレーションにおいて、Git ワークフローは見落とされがちな基盤インフラですが、崩壊すると非常に辛くなります。フロントエンドチームに適した規約をまとめます。"
wordCount: 601
---

チームコラボレーションにおいて、Git ワークフローは見落とされがちな基盤インフラですが、崩壊すると非常に辛くなります。フロントエンドチームに適した規約をまとめます。

## Git Flow の基礎

主流の Git Flow は以下のブランチを含みます：

```
main          本番環境、常に安定してリリース可能な状態
develop       開発のトランク、すべての機能を統合
feature/*     機能開発ブランチ
release/*     リリース準備ブランチ
hotfix/*      緊急修正ブランチ
```

### 日常的な開発フロー

```bash
# 1. develop から機能ブランチを切る
git checkout develop
git pull origin develop
git checkout -b feature/user-profile

# 2. 開発してコミット
git add .
git commit -m "feat: add user profile page"

# 3. 完了したら develop にマージ（PR/MR 経由を推奨）
git checkout develop
git merge --no-ff feature/user-profile  # --no-ff でマージ記録を保持
git push origin develop

# 4. 機能ブランチを削除
git branch -d feature/user-profile
```

## コミットメッセージの規約

統一されたコミットメッセージにより、`git log` で各コミットが何をしたかを一目で確認でき、changelog の自動生成もできます。

**フォーマット：**

```
<type>(<scope>): <description>

[任意 body]

[任意 footer]
```

**type の種類：**

| type       | 意味                                       |
| ---------- | ------------------------------------------ |
| `feat`     | 新機能                                     |
| `fix`      | バグ修正                                   |
| `docs`     | ドキュメント更新                           |
| `style`    | コードフォーマット（ロジックに影響なし）   |
| `refactor` | リファクタリング（feat でも fix でもない） |
| `perf`     | パフォーマンス最適化                       |
| `test`     | テスト関連                                 |
| `chore`    | ビルド/ツール/依存関係の更新               |
| `revert`   | 巻き戻し                                   |

**良い例：**

```
feat(auth): add login with Google OAuth
fix(table): correct pagination when deleting last item on page
docs(readme): update deployment instructions
chore(deps): upgrade element-ui to 2.4.11
```

**悪い例：**

```
update
fix bug
変更
wip
```

## commitlint + husky で規約を強制する

文書による約束だけでは不十分、ツールで強制します：

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

```json
// package.json
{
  "husky": {
    "hooks": {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

コミットが規約に従っていない場合、husky がコミットを拒否します：

```bash
$ git commit -m "update"
husky > commit-msg (node v10.15.0)
⧗   input: update
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings
```

## lint-staged：コミット前のコードチェック

```bash
npm install --save-dev lint-staged
```

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "src/**/*.{js,vue}": ["eslint --fix", "git add"],
    "src/**/*.{css,scss}": ["stylelint --fix", "git add"]
  }
}
```

これにより今回のコミット対象ファイルのみをチェックし、速くてプロジェクト全体の lint に影響しません。

## バージョン番号の管理

セマンティックバージョニング：`MAJOR.MINOR.PATCH`

- `MAJOR`：互換性のない API の変更（1.0.0 → 2.0.0）
- `MINOR`：後方互換性のある新機能（1.0.0 → 1.1.0）
- `PATCH`：後方互換性のあるバグ修正（1.0.0 → 1.0.1）

```bash
# npm version コマンドで自動的にバージョンを更新
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

## よく使う Git コマンド

```bash
# グラフィカルなログを表示
git log --oneline --graph --all

# 最後のコミットを取り消す（ファイルの変更は保持）
git reset --soft HEAD~1

# 特定ファイルの変更を取り消す
git checkout -- src/components/Button.vue

# 現在の作業をスタッシュ
git stash save "WIP: ユーザーページの変更"
git stash pop  # 復元

# 特定のコミットを現在のブランチに取り込む
git cherry-pick abc1234

# インタラクティブ rebase（コミット履歴を整理）
git rebase -i HEAD~3
```

## .gitignore テンプレート

```ini
# 依存関係
node_modules/

# ビルド成果物
dist/
build/

# 環境変数
.env.local
.env.*.local

# エディタ
.DS_Store
.vscode/settings.json
*.swp
*.swo

# ログ
*.log
npm-debug.log*
yarn-debug.log*

# テストカバレッジ
coverage/
```

## まとめ

- Git Flow は明確なブランチ戦略を提供する
- コミットメッセージの規約で履歴を読みやすくし、changelog の自動生成ができる
- `husky + commitlint + lint-staged` の三点セットはエンジニアリングの標準装備
- 小さくコミットし、各コミットは一つのことだけを行う
