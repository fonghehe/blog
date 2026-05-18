---
title: "Git Hooks 和代码质量自动化"
date: 2018-08-21 10:12:35
tags:
  - Git
readingTime: 2
description: "每次提交代码前手动跑 lint 和测试太容易忘了。用 Git Hooks 把这些检查自动化，在提交时自动执行。"
---

每次提交代码前手动跑 lint 和测试太容易忘了。用 Git Hooks 把这些检查自动化，在提交时自动执行。

## Git Hooks 是什么

Git 在特定事件（提交、推送等）前后会触发对应的脚本，叫 Hook。

```
pre-commit：git commit 前触发（最常用）
commit-msg：检查 commit message 格式
pre-push：git push 前触发
post-merge：git pull/merge 后触发（可以自动跑 npm install）
```

## Husky：管理 Git Hooks

手写 `.git/hooks/pre-commit` 脚本不便于共享给团队，用 Husky：

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

## lint-staged：只检查暂存区的文件

如果每次提交都对整个项目跑 lint，老项目会很慢。`lint-staged` 只处理这次提交的文件：

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

执行流程：

1. `git commit` 触发 `pre-commit` hook
2. `lint-staged` 找出暂存区（staged）的文件
3. 只对这些文件运行 ESLint 和 Prettier
4. 如果有错误，commit 失败；如果自动修复了，重新 add 修复后的文件

## commit-msg：规范提交信息

```javascript
// scripts/verify-commit-msg.js
const fs = require("fs");
const msg = fs.readFileSync(process.env.HUSKY_GIT_PARAMS, "utf-8").trim();

// Angular 提交规范
const commitReg =
  /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}/;

if (!commitReg.test(msg)) {
  console.error("提交信息格式不符合规范！");
  console.error("正确格式：feat(scope): 描述");
  console.error("类型：feat|fix|docs|style|refactor|test|chore");
  process.exit(1);
}
```

或者用 `commitlint`（更成熟的方案）：

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

## post-merge：自动安装新依赖

```bash
# .git/hooks/post-merge（或用 Husky）
#!/bin/bash
# 检查 package.json 有没有变化，有则自动 npm install
changed_files=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)
if echo "$changed_files" | grep -q "package.json"; then
  echo "package.json changed, running npm install..."
  npm install
fi
```

## 团队配置共享

```json
// package.json
{
  "scripts": {
    "prepare": "husky install" // npm install 后自动启用 husky
  }
}
```

这样团队里任何人 `npm install` 之后，Git Hooks 就自动生效了。

## 小结

- Husky：让 Git Hooks 配置放在 package.json，方便团队共享
- lint-staged：只检查本次提交的文件，速度快
- commitlint：规范 commit message，方便生成 changelog
- `prepare` 脚本：`npm install` 时自动初始化 Husky