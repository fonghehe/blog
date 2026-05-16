---
title: "Git Workflow Best Practices for Teams"
date: 2019-06-13 14:43:48
tags:
  - Engineering
readingTime: 1
description: "Coding solo, you can use Git however you like. Team collaboration is different — branch management, commit messages, and code review each need standards or thin"
---

Coding solo, you can use Git however you like. Team collaboration is different — branch management, commit messages, and code review each need standards or things get messy. This article covers workflow practices I've validated in real teams.

## Git Flow vs GitHub Flow

Two mainstream branching models, each suited to different scenarios:

**Git Flow** — for projects with defined release cycles (e.g., app versioning):

```
main (master) ← only tagged on version releases
  ↑
release/v1.2.0 ← preparation branch, only bug fixes
  ↑
develop ← daily development integration branch
  ↑    ↑
feature/login  feature/payment ← feature branches
```

**GitHub Flow** — for continuously deployed projects (e.g., SaaS, web apps):

```
main ← always deployable
  ↑
feature/xxx ← branch from main, PR back to main when done
```

Most frontend teams in 2019 use a variant of GitHub Flow, because web projects typically deploy continuously without needing complex release branches.

## Branch Naming Convention

```bash
# Format: type/short-description
# Common types: feature, fix, hotfix, release, chore

# ✅ Good names
git checkout -b feature/user-login
git checkout -b feature/order-list-pagination
git checkout -b fix/cart-calculation-error
git checkout -b hotfix/production-crash-0601
git checkout -b release/v2.3.0
git checkout -b chore/upgrade-webpack-4

# ❌ Bad names
git checkout -b dev           # dev what?
git checkout -b test          # test what?
git checkout -b my-branch     # meaningless to others
git checkout -b fix-bug       # which bug?
```

## Commit Message Convention (Conventional Commits)

```
type(scope): description

body (optional)

footer (optional)
```

```bash
# ✅ Good commits
git commit -m "feat(auth): add JWT refresh token mechanism"
git commit -m "fix(cart): correct item quantity calculation"
git commit -m "perf(list): use virtual scroll to optimize 10k-item rendering"
git commit -m "docs(api): update user endpoint documentation"

# ❌ Bad commits
git commit -m "fix"
git commit -m "update"
git commit -m "wip"
```

## Rebase vs Merge: Keeping a Linear History

```bash
# Feature branch development workflow
git checkout -b feature/new-feature
# ... develop ...

# Before merging, rebase to get the latest main
git fetch origin
git rebase origin/main

# Resolve any conflicts, then create a PR
# In the PR, use "Squash and Merge" or "Rebase and Merge"
```

A linear commit history makes `git bisect` and `git log` much more effective — worth the extra discipline.
