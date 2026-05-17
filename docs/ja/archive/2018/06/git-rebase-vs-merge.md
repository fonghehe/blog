---
title: "Git rebaseとmerge：どちらを選ぶか"
date: 2018-06-26 16:19:41
tags:
  - エンジニアリング
readingTime: 2
description: "チームではrebaseとmergeのどちらを使うかよく議論になり、両方に支持者がいます。違いと使いどころを整理しておきます。"
---

チームではrebaseとmergeのどちらを使うかよく議論になり、両方に支持者がいます。違いと使いどころを整理しておきます。

## merge：完全な履歴を保持する

```bash
git checkout feature
git merge main
```

```
      A---B---C  feature
     /         \
D---E---F---G---H  (merge commit)
```

`merge`は新しいmerge commitを作成し、ブランチが分岐した時点の完全な履歴を保持します。

## rebase：線形の履歴

```bash
git checkout feature
git rebase main
```

```
# Before
      A---B  feature
     /
D---E---F---G  main

# After rebase
              A'--B'  feature
             /
D---E---F---G  main
```

`rebase`はfeatureブランチのコミットをmainの最新コミットの上に「再適用」し、履歴が線形になりmerge commitがなくなります。

## それぞれの長所・短所

**merge**

- ✅ 安全、既存のコミットを変更しない
- ✅ ブランチの真の履歴を記録する
- ❌ 大量のmerge commitで履歴が散らかる

**rebase**

- ✅ 線形の履歴、`git log`がすっきり
- ✅ `git bisect`でバグを見つけやすい
- ❌ コミット履歴を書き換える（コミットハッシュが変わる）
- ❌ すでにpushした公開ブランチには使えない

## 黄金律

**公開ブランチ（main、developなど）は絶対にrebaseしない**

```bash
# ❌ 危険！他の人のコミット履歴が混乱する
git checkout main
git rebase feature

# ✅ 安全：自分のローカルfeatureブランチのみrebase
git checkout my-feature
git rebase main
```

## 推奨ワークフロー

```bash
# 新機能の開発を開始
git checkout -b feature/login

# 開発中は定期的にmainブランチを同期（rebaseで線形履歴を保持）
git fetch origin
git rebase origin/main

# 開発完了、push
git push origin feature/login

# GitLab/GitHubでMR/PRを作成
# マージ時は「Squash and merge」または「Rebase and merge」を選択
```

## インタラクティブrebase（コミットを整理する）

```bash
# 直近3つのコミットを整理
git rebase -i HEAD~3
```

```
pick abc1234 feat: add login form
squash def5678 fix: typo
squash ghi9012 fix: another typo

# squash：複数のコミットを1つにまとめる
# reword：コミットメッセージを編集する
# fixup：コミットメッセージを破棄してまとめる
# drop：このコミットを削除する
```

pushする前に細かなコミットを整理することで、MRがきれいになります。

## rebaseの競合を解決する

```bash
git rebase main

# 競合が発生したとき
# 1. 競合ファイルを解決する
# 2. 解決済みファイルをgit addする
# 3. git rebase --continue  （git commitではない！）

# rebaseを中止する
git rebase --abort
```

## 私たちのチームのやり方

- featureブランチをmainにマージ：**squash merge**（機能ごとに1コミット）
- 個人のfeatureブランチをmainと同期：**rebase**（線形を保持）
- 緊急hotfix：**merge**（速い、履歴を整理する必要なし）

## まとめ

- mergeは安全で履歴を保持する；rebaseは線形できれいな履歴になる
- 公開ブランチへはmergeのみ、ローカルのfeatureブランチはrebaseしてよい
- pushする前にインタラクティブrebaseで細かなコミットを整理する
- どちらの方式かよりも、チームで統一したルールを持つことが大切
