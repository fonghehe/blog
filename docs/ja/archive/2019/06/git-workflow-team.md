---
title: "チームのGitワークフローベストプラクティス"
date: 2019-06-13 14:43:48
tags:
  - エンジニアリング
readingTime: 2
description: "個人でコードを書くなら、Gitはどう使っても構いません。チームコラボレーションは違います——ブランチの管理、コミットメッセージの書き方、コードレビューの仕方、それぞれに規範がなければ混乱します。本記事では実際のチームで検証したワークフローの実践をまとめます。"
wordCount: 361
---

個人でコードを書くなら、Gitはどう使っても構いません。チームコラボレーションは違います——ブランチの管理、コミットメッセージの書き方、コードレビューの仕方、それぞれに規範がなければ混乱します。本記事では実際のチームで検証したワークフローの実践をまとめます。

## Git Flow vs GitHub Flow

2つの主流ブランチモデル、それぞれ適したシナリオがあります：

**Git Flow** ——明確なリリースサイクルがあるプロジェクト向け（アプリのバージョンリリースなど）：

```
main (master) ← バージョンリリース時のみタグ付け
  ↑
release/v1.2.0 ← リリース前の準備ブランチ、バグ修正のみ
  ↑
develop ← 日々の開発の統合ブランチ
  ↑    ↑
feature/login  feature/payment ← フィーチャーブランチ
```

**GitHub Flow** ——継続的デプロイのプロジェクト向け（SaaS・Webアプリなど）：

```
main ← 常にデプロイ可能
  ↑
feature/xxx ← mainから作成、完成後にmainへPR
```

2019年のほとんどのフロントエンドチームはGitHub Flowの変形を使っています。WebプロジェクトはたいてV継続的にデプロイされ、複雑なreleaseブランチが不要だからです。

## ブランチ命名規則

```bash
# フォーマット: タイプ/短い説明
# よく使うタイプ: feature, fix, hotfix, release, chore

# ✅ 良い命名
git checkout -b feature/user-login
git checkout -b feature/order-list-pagination
git checkout -b fix/cart-calculation-error
git checkout -b hotfix/production-crash-0601
git checkout -b release/v2.3.0
git checkout -b chore/upgrade-webpack-4

# ❌ 悪い命名
git checkout -b dev           # devとは何？
git checkout -b test          # 何のテスト？
git checkout -b my-branch     # 他の人には意味不明
git checkout -b fix-bug       # どのバグ？
```

## コミットメッセージ規則（Conventional Commits）

```
type(scope): description

body（任意）

footer（任意）
```

```bash
# ✅ 良いコミット
git commit -m "feat(auth): JWTリフレッシュトークン機構を追加"
git commit -m "fix(cart): 商品数量の計算を修正"
git commit -m "perf(list): 仮想スクロールで1万件リストのレンダリングを最適化"
git commit -m "docs(api): ユーザーエンドポイントのドキュメントを更新"

# ❌ 悪いコミット
git commit -m "fix"
git commit -m "update"
git commit -m "wip"
```

## Rebase vs Merge：線形な履歴を保つ

```bash
# フィーチャーブランチの開発ワークフロー
git checkout -b feature/new-feature
# ... 開発 ...

# マージ前に最新のmainをリベース
git fetch origin
git rebase origin/main

# 競合を解決してPRを作成
# PRでは"Squash and Merge"か"Rebase and Merge"を使用
```

線形なコミット履歴により`git bisect`と`git log`がはるかに効果的になります——少し規律が必要ですがその価値はあります。
