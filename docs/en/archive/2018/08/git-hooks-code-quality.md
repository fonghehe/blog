---
title: "Git Hooks and Code Quality Automation"
date: 2018-08-21 10:12:35
tags:
  - Git
readingTime: 2
description: "Manually running lint and tests before every commit is easy to forget. Use Git Hooks to automate these checks so they run automatically on commit."
---

Manually running lint and tests before every commit is easy to forget. Use Git Hooks to automate these checks so they run automatically on commit.

## What are Git Hooks

Git triggers corresponding scripts before/after specific events (commits, pushes, etc.) — these are Hooks.

```
pre-commit:  triggers before git commit (most common)
commit-msg:  checks commit message format
pre-push:    triggers before git push
post-merge:  triggers after git pull/merge (can auto-run npm install)
```

## Husky: Managing Git Hooks

Manually writing `.git/hooks/pre-commit` scripts is inconvenient to share with the team. Use Husky instead:

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

## lint-staged: Only Check Staged Files

Running lint on the entire project on every commit is slow for large projects. `lint-staged` only processes files in this commit:

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

Execution flow:

1. `git commit` triggers the `pre-commit` hook
2. `lint-staged` finds staged files
3. Runs ESLint and Prettier only on those files
4. If there are errors, commit fails; if auto-fixed, re-adds fixed files

## commit-msg: Standardize Commit Messages

```javascript
// scripts/verify-commit-msg.js
const fs = require("fs");
const msg = fs.readFileSync(process.env.HUSKY_GIT_PARAMS, "utf-8").trim();

// Angular commit convention
const commitReg =
  /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}/;

if (!commitReg.test(msg)) {
  console.error("Commit message does not follow the convention!");
  console.error("Correct format: feat(scope): description");
  console.error("Types: feat|fix|docs|style|refactor|test|chore");
  process.exit(1);
}
```

Or use `commitlint` (more mature solution):

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

## post-merge: Auto-install New Dependencies

```bash
# .git/hooks/post-merge (or use Husky)
#!/bin/bash
# Check if package.json changed, if so auto-run npm install
changed_files=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)
if echo "$changed_files" | grep -q "package.json"; then
  echo "package.json changed, running npm install..."
  npm install
fi
```

## Sharing Team Config

```json
// package.json
{
  "scripts": {
    "prepare": "husky install" // automatically activates husky after npm install
  }
}
```

Anyone on the team who runs `npm install` will have Git Hooks automatically activated.

## Summary

- Husky: puts Git Hook config in package.json for easy team sharing
- lint-staged: only checks files in this commit, much faster
- commitlint: standardizes commit messages, useful for generating changelogs
- `prepare` script: initializes Husky automatically after `npm install`
