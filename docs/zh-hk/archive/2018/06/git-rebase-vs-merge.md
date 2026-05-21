---
title: "Git rebase 與 merge：如何選擇"
date: 2018-06-26 16:19:41
tags:
  - 工程化
readingTime: 2
description: "團隊裏經常討論用 rebase 還是 merge，各有支持者。理清一下兩者的區別和適用場景。"
wordCount: 345
---

團隊裏經常討論用 rebase 還是 merge，各有支持者。理清一下兩者的區別和適用場景。

## merge：保留完整歷史

```bash
git checkout feature
git merge main
```

```
      A
---B---C  feature
     /         \
D---E---F---G---H  (merge commit)
```

merge 會創建一個新的 merge commit，保留了分支發生時的完整歷史。

## rebase：線性歷史

```bash
git checkout feature
git rebase main
```

```
# 之前
      A---B  feature
     /
D---E---F---G  main

# rebase 後
              A'--B'  feature
             /
D---E---F---G  main
```

rebase 把 feature 上的提交"重新應用"到 main 的最新提交上，歷史變得線性，沒有 merge commit。

## 各自的優缺點

**merge**

- ✅ 安全，不改變已有提交
- ✅ 記錄了分支的真實歷史
- ❌ 大量 merge commit 導致歷史嘈雜

**rebase**

- ✅ 歷史線性，`git log` 清晰
- ✅ 便於 `git bisect` 查找 bug
- ❌ 改寫了提交歷史（commit hash 變了）
- ❌ 不能用於已經 push 的公共分支

## 黃金法則

**永遠不要 rebase 公共分支**（main、develop 等）

```bash
# ❌ 危險！會讓其他人的提交歷史混亂
git checkout main
git rebase feature

# ✅ 安全：只 rebase 自己的本地 feature 分支
git checkout my-feature
git rebase main
```

## 推薦工作流

```bash
# 開發新功能
git checkout -b feature/login

# 開發中定期同步主分支（rebase 保持線性歷史）
git fetch origin
git rebase origin/main

# 開發完成，推送
git push origin feature/login

# 在 GitLab/GitHub 創建 MR/PR
# 合併時選擇 "Squash and merge" 或 "Rebase and merge"
```

## 交互式 rebase（整理提交）

```bash
# 整理最近 3 個提交
git rebase -i HEAD~3
```

```
pick abc1234 feat: add login form
squash def5678 fix: typo
squash ghi9012 fix: another typo

# squash 把多個 commit 合併成一個
# reword 修改 commit message
# fixup 合併但丟棄 commit message
# drop 刪除這個 commit
```

推送前把零碎的 commit 整理一下，MR 更好看。

## 解決 rebase 衝突

```bash
git rebase main

# 遇到衝突時
# 1. 解決衝突文件
# 2. git add 已解決的文件
# 3. git rebase --continue  （不是 git commit！）

# 放棄 rebase
git rebase --abort
```

## 我們團隊的做法

- feature 分支合併到 main：用 **squash merge**（一個功能一個提交）
- 個人 feature 分支同步 main：用 **rebase**（保持線性）
- 緊急 hotfix：用 **merge**（快，不需要整理歷史）

## 小結

- merge 安全、保留歷史；rebase 線性、歷史乾淨
- 公共分支只用 merge，本地 feature 分支可以 rebase
- 推送前用交互式 rebase 整理零碎 commit
- 團隊統一一套規範比哪種方式更重要
