---
title: "前端工程化：Git 工作流規範"
date: 2018-03-27 10:12:36
tags:
  - 工程化
readingTime: 2
description: "團隊協作裏 Git 工作流是個容易被忽視的基礎設施，但亂了之後非常痛苦。整理一套適合前端團隊的規範。"
wordCount: 354
---

團隊協作裏 Git 工作流是個容易被忽視的基礎設施，但亂了之後非常痛苦。整理一套適合前端團隊的規範。

## Git Flow 基礎

主流的 Git Flow 包含以下分支：

```
main          生產環境，永遠是穩定可發佈的狀態
develop       開發主幹，集成所有功能
feature/*     功能開發分支
release/*     發佈準備分支
hotfix/*      緊急修復分支
```

### 日常開發流程

```bash
# 1. 從 develop 拉出功能分支
git checkout develop
git pull origin develop
git checkout -b feature/user-profile

# 2. 開發、提交
git add .
git commit -m "feat: add user profile page"

# 3. 完成後合併回 develop（推薦用 PR/MR 方式）
git checkout develop
git merge --no-ff feature/user-profile  # --no-ff 保留合併記錄
git push origin develop

# 4. 刪除功能分支
git branch -d feature/user-profile
```

## Commit Message 規範

統一的 commit message 讓 `git log` 一眼看出每次提交做了什麼，也能自動生成 changelog。

**格式：**

```
<type>(<scope>): <description>

[可選 body]

[可選 footer]
```

**type 類型：**

| type       | 含義                         |
| 
---------- | ---------------------------- |
| `feat`     | 新功能                       |
| `fix`      | Bug 修復                     |
| `docs`     | 文檔更新                     |
| `style`    | 代碼格式（不影響邏輯）       |
| `refactor` | 重構（不是 feat 也不是 fix） |
| `perf`     | 性能優化                     |
| `test`     | 測試相關                     |
| `chore`    | 構建/工具/依賴更新           |
| `revert`   | 回滾                         |

**好的例子：**

```
feat(auth): add login with Google OAuth
fix(table): correct pagination when deleting last item on page
docs(readme): update deployment instructions
chore(deps): upgrade element-ui to 2.4.11
```

**壞的例子：**

```
update
fix bug
修改
wip
```

## commitlint + husky 強製規範

光靠文檔約定不夠，用工具強製：

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

提交不符合規範時，husky 會拒絕 commit：

```bash
$ git commit -m "update"
husky > commit-msg (node v10.15.0)
⧗   input: update
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings
```

## lint-staged：提交前檢查代碼

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

這樣隻檢查本次提交的檔案，速度快，不影響整個項目的 lint。

## 版本號管理

語義化版本（Semantic Versioning）：`MAJOR.MINOR.PATCH`

- `MAJOR`：不兼容的 API 變化（1.0.0 → 2.0.0）
- `MINOR`：向後兼容的新功能（1.0.0 → 1.1.0）
- `PATCH`：向後兼容的 Bug 修復（1.0.0 → 1.0.1）

```bash
# 用 npm version 命令自動更新版本
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

## 常用 Git 操作

```bash
# 查看圖形化日誌
git log --oneline --graph --all

# 撤銷最後一次提交（保留檔案改動）
git reset --soft HEAD~1

# 撤銷某個檔案的修改
git checkout -- src/components/Button.vue

# 暫存當前工作
git stash save "WIP: 用户頁面修改"
git stash pop  # 恢復

# 合併某個 commit 到當前分支
git cherry-pick abc1234

# 交互式 rebase（整理 commit 歷史）
git rebase -i HEAD~3
```

## .gitignore 範本

```ini
# 依賴
node_modules/

# 構建產物
dist/
build/

# 環境變量
.env.local
.env.*.local

# 編輯器
.DS_Store
.vscode/settings.json
*.swp
*.swo

# 日誌
*.log
npm-debug.log*
yarn-debug.log*

# 測試覆蓋率
coverage/
```

## 小結

- Git Flow 提供了清晰的分支策略
- commit message 規範讓歷史可讀，能自動生成 changelog
- `husky + commitlint + lint-staged` 三件套是工程化標配
- 小步提交，每個 commit 隻做一件事
