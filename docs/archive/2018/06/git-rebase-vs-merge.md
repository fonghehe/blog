---
title: "Git rebase 与 merge：如何选择"
date: 2018-06-26 16:19:41
tags:
  - 工程化
readingTime: 2
description: "团队里经常讨论用 rebase 还是 merge，各有支持者。理清一下两者的区别和适用场景。"
wordCount: 345
---

团队里经常讨论用 rebase 还是 merge，各有支持者。理清一下两者的区别和适用场景。

## merge：保留完整历史

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

merge 会创建一个新的 merge commit，保留了分支发生时的完整历史。

## rebase：线性历史

```bash
git checkout feature
git rebase main
```

```
# 之前
      A---B  feature
     /
D---E---F---G  main

# rebase 后
              A'--B'  feature
             /
D---E---F---G  main
```

rebase 把 feature 上的提交"重新应用"到 main 的最新提交上，历史变得线性，没有 merge commit。

## 各自的优缺点

**merge**

- ✅ 安全，不改变已有提交
- ✅ 记录了分支的真实历史
- ❌ 大量 merge commit 导致历史嘈杂

**rebase**

- ✅ 历史线性，`git log` 清晰
- ✅ 便于 `git bisect` 查找 bug
- ❌ 改写了提交历史（commit hash 变了）
- ❌ 不能用于已经 push 的公共分支

## 黄金法则

**永远不要 rebase 公共分支**（main、develop 等）

```bash
# ❌ 危险！会让其他人的提交历史混乱
git checkout main
git rebase feature

# ✅ 安全：只 rebase 自己的本地 feature 分支
git checkout my-feature
git rebase main
```

## 推荐工作流

```bash
# 开发新功能
git checkout -b feature/login

# 开发中定期同步主分支（rebase 保持线性历史）
git fetch origin
git rebase origin/main

# 开发完成，推送
git push origin feature/login

# 在 GitLab/GitHub 创建 MR/PR
# 合并时选择 "Squash and merge" 或 "Rebase and merge"
```

## 交互式 rebase（整理提交）

```bash
# 整理最近 3 个提交
git rebase -i HEAD~3
```

```
pick abc1234 feat: add login form
squash def5678 fix: typo
squash ghi9012 fix: another typo

# squash 把多个 commit 合并成一个
# reword 修改 commit message
# fixup 合并但丢弃 commit message
# drop 删除这个 commit
```

推送前把零碎的 commit 整理一下，MR 更好看。

## 解决 rebase 冲突

```bash
git rebase main

# 遇到冲突时
# 1. 解决冲突文件
# 2. git add 已解决的文件
# 3. git rebase --continue  （不是 git commit！）

# 放弃 rebase
git rebase --abort
```

## 我们团队的做法

- feature 分支合并到 main：用 **squash merge**（一个功能一个提交）
- 个人 feature 分支同步 main：用 **rebase**（保持线性）
- 紧急 hotfix：用 **merge**（快，不需要整理历史）

## 小结

- merge 安全、保留历史；rebase 线性、历史干净
- 公共分支只用 merge，本地 feature 分支可以 rebase
- 推送前用交互式 rebase 整理零碎 commit
- 团队统一一套规范比哪种方式更重要
