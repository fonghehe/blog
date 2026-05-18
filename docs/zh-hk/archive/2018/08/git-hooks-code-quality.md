---
title: "Git Hooks 和代碼質量自動化"
date: 2018-08-21 10:12:35
tags:
  - Git
readingTime: 2
description: "每次提交代碼前手動跑 lint 和測試太容易忘了。用 Git Hooks 把這些檢查自動化，在提交時自動執行。"
---

每次提交代碼前手動跑 lint 和測試太容易忘了。用 Git Hooks 把這些檢查自動化，在提交時自動執行。

## Git Hooks 是什麼

Git 在特定事件（提交、推送等）前後會觸發對應的腳本，叫 Hook。

```
pre-commit：git commit 前觸發（最常用）
commit-msg：檢查 commit message 格式
pre-push：git push 前觸發
post-merge：git pull/merge 後觸發（可以自動跑 npm install）
```

## Husky：管理 Git Hooks

手寫 `.git/hooks/pre-commit` 腳本不便於共享給團隊，用 Husky：

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

## lint-staged：只檢查暫存區的文件

如果每次提交都對整個項目跑 lint，老項目會很慢。`lint-staged` 只處理這次提交的文件：

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

執行流程：

1. `git commit` 觸發 `pre-commit` hook
2. `lint-staged` 找出暫存區（staged）的文件
3. 只對這些文件運行 ESLint 和 Prettier
4. 如果有錯誤，commit 失敗；如果自動修復了，重新 add 修復後的文件

## commit-msg：規範提交信息

```javascript
// scripts/verify-commit-msg.js
const fs = require("fs");
const msg = fs.readFileSync(process.env.HUSKY_GIT_PARAMS, "utf-8").trim();

// Angular 提交規範
const commitReg =
  /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}/;

if (!commitReg.test(msg)) {
  console.error("提交信息格式不符合規範！");
  console.error("正確格式：feat(scope): 描述");
  console.error("類型：feat|fix|docs|style|refactor|test|chore");
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

## post-merge：自動安裝新依賴

```bash
# .git/hooks/post-merge（或用 Husky）
#!/bin/bash
# 檢查 package.json 有沒有變化，有則自動 npm install
changed_files=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)
if echo "$changed_files" | grep -q "package.json"; then
  echo "package.json changed, running npm install..."
  npm install
fi
```

## 團隊配置共享

```json
// package.json
{
  "scripts": {
    "prepare": "husky install" // npm install 後自動啓用 husky
  }
}
```

這樣團隊裏任何人 `npm install` 之後，Git Hooks 就自動生效了。

## 小結

- Husky：讓 Git Hooks 配置放在 package.json，方便團隊共享
- lint-staged：只檢查本次提交的文件，速度快
- commitlint：規範 commit message，方便生成 changelog
- `prepare` 腳本：`npm install` 時自動初始化 Husky