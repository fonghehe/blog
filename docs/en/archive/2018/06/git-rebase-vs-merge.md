---
title: "Git rebase vs merge: How to Choose"
date: 2018-06-26 16:19:41
tags:
  - Engineering
readingTime: 2
description: "The team frequently debates rebase vs merge, with supporters on both sides. Let me clarify the differences and when to use each."
wordCount: 234
---

The team frequently debates rebase vs merge, with supporters on both sides. Let me clarify the differences and when to use each.

## merge: Preserve the Full History

```bash
git checkout feature
git merge main
```

```
      A---B---C  feature
     /         \
D---E---F---G---H  (merge commit)
```

`merge` creates a new merge commit, preserving the full history of when the branch diverged.

## rebase: Linear History

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

`rebase` "re-applies" commits from the feature branch onto the latest commit of main, making history linear with no merge commits.

## Pros and Cons

**merge**

- ✅ Safe, doesn't change existing commits
- ✅ Records the true history of branches
- ❌ Many merge commits make history noisy

**rebase**

- ✅ Linear history, `git log` is clean
- ✅ Easier to use `git bisect` to find bugs
- ❌ Rewrites commit history (commit hashes change)
- ❌ Cannot be used on already-pushed public branches

## The Golden Rule

**Never rebase a public branch** (main, develop, etc.)

```bash
# ❌ Dangerous! Will mess up others' commit history
git checkout main
git rebase feature

# ✅ Safe: only rebase your own local feature branch
git checkout my-feature
git rebase main
```

## Recommended Workflow

```bash
# Start a new feature
git checkout -b feature/login

# Periodically sync with main during development (rebase for linear history)
git fetch origin
git rebase origin/main

# Push when done
git push origin feature/login

# Create MR/PR on GitLab/GitHub
# When merging, choose "Squash and merge" or "Rebase and merge"
```

## Interactive Rebase (Clean Up Commits)

```bash
# Clean up the last 3 commits
git rebase -i HEAD~3
```

```
pick abc1234 feat: add login form
squash def5678 fix: typo
squash ghi9012 fix: another typo

# squash: merge multiple commits into one
# reword: edit commit message
# fixup: merge but discard commit message
# drop: delete this commit
```

Clean up scattered commits before pushing — it makes the MR much tidier.

## Resolving rebase Conflicts

```bash
git rebase main

# When a conflict occurs:
# 1. Resolve the conflicting files
# 2. git add the resolved files
# 3. git rebase --continue  (NOT git commit!)

# Abort the rebase
git rebase --abort
```

## Our Team's Approach

- Merging feature branches into main: **squash merge** (one commit per feature)
- Syncing a personal feature branch with main: **rebase** (keep it linear)
- Emergency hotfixes: **merge** (fast, no need to clean up history)

## Summary

- merge is safe and preserves history; rebase gives linear, clean history
- Only merge into public branches; rebase your own local feature branches
- Use interactive rebase to clean up scattered commits before pushing
- A unified team convention matters more than which method you choose
