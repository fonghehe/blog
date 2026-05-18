---
title: "團隊 Git 工作流最佳實踐"
date: 2019-06-13 14:43:48
tags:
  - 工程化
readingTime: 4
description: "個人寫代碼，Git 隨便用都行。但團隊協作就不一樣了——分支怎麼管理、提交信息怎麼寫、代碼怎麼審查，每個環節沒有規範就會亂。這篇文章整理了我在實際團隊中驗證過的工作流實踐。"
---

個人寫代碼，Git 隨便用都行。但團隊協作就不一樣了——分支怎麼管理、提交信息怎麼寫、代碼怎麼審查，每個環節沒有規範就會亂。這篇文章整理了我在實際團隊中驗證過的工作流實踐。

## Git Flow vs GitHub Flow

兩種主流的分支模型，各有適用場景：

**Git Flow**——適合有明確發佈週期的項目（如 App 版本發佈）：

```
main (master) ← 只有版本發佈時才打 tag
  ↑
release/v1.2.0 ← 發佈前的準備分支，只修 bug
  ↑
develop ← 日常開發的集成分支
  ↑    ↑
feature/login  feature/payment ← 功能分支
```

**GitHub Flow**——適合持續部署的項目（如 SaaS、Web 應用）：

```
main ← 隨時可部署
  ↑
feature/xxx ← 從 main 創建，完成後 PR 合回 main
```

2019 年大多數前端團隊用的是 GitHub Flow 的變體，因為 Web 項目通常持續部署，不需要複雜的 release 分支。

## 分支命名規範

混亂的分支命名是協作的第一道坎。統一命名規範可以讓團隊一眼看出分支用途：

```bash
# 分支命名格式：類型/簡短描述
# 類型常用：feature、fix、hotfix、release、chore

# ✅ 好的命名
git checkout -b feature/user-login
git checkout -b feature/order-list-pagination
git checkout -b fix/cart-calculation-error
git checkout -b hotfix/production-crash-0601
git checkout -b release/v2.3.0
git checkout -b chore/upgrade-webpack-4

# ❌ 差的命名
git checkout -b dev           # dev 是什麼？
git checkout -b test          # 測試什麼？
git checkout -b my-branch     # 你的分支，別人看不懂
git checkout -b fix-bug       # 什麼 bug？
git checkout -b 0601          # 數字是什麼意思？
```

可以在項目中配置分支命名檢查（配合 husky）：

```bash
#!/bin/sh
# .git/hooks/pre-push 或通過 husky 配置
branch=$(git rev-parse --abbrev-ref HEAD)
valid_pattern="^(feature|fix|hotfix|release|chore)/[a-z0-9._-]+$"

if ! echo "$branch" | grep -qE "$valid_pattern"; then
  echo "分支名 '$branch' 不符合規範"
  echo "正確格式: feature|fix|hotfix|release|chore/描述"
  echo "示例: feature/user-login"
  exit 1
fi
```

## Rebase vs Merge：保持線性歷史

這是團隊中討論最多的 Git 話題之一。核心區別：

```bash
# 場景：你在 feature/login 上開發，main 上有新的提交

# === Merge 方式 ===
# 把 main 的變更合併到你的分支，產生一個合併提交
git checkout feature/login
git merge main
# 結果：多了一個 merge commit，歷史出現分叉又匯合

# === Rebase 方式 ===
# 把你的提交「搬到」main 的最新提交之後
git checkout feature/login
git rebase main
# 結果：線性歷史，沒有多餘的 merge commit
```

```
Merge 歷史（有分叉）：
*   Merge branch 'main' into feature/login
|\
| * fix: 更新了配置文件
* | feat: 添加登錄頁面
|/
* chore: 更新依賴
* feat: 初始化項目

Rebase 歷史（線性）：
* feat: 添加登錄頁面
* fix: 更新了配置文件
* chore: 更新依賴
* feat: 初始化項目
```

實際團隊中的建議：

```bash
# 功能分支開發過程中：用 rebase 同步 main 的最新代碼
git checkout feature/user-login
git fetch origin
git rebase origin/main

# 如果 rebase 過程中有衝突，解決後繼續
git add .
git rebase --continue

# 如果 rebase 搞亂了想放棄，可以隨時回退
git rebase --abort

# ⚠️ 黃金規則：永遠不要 rebase 已經推送到遠程的公共分支！
# 只 rebase 你自己獨佔的功能分支。
# 如果你和同事共享 feature 分支，不要 rebase。
```

## 交互式 Rebase：整理提交歷史

功能開發完準備合入 main 之前，用交互式 rebase 把亂七八糟的提交整理成有意義的幾個提交：

```bash
# 假設你的功能分支有 5 個提交
git log --oneline feature/user-login
# abc1234 WIP: 登錄表單
# def5678 修了個 typo
# ghi9012 WIP: 接入接口
# jkl3456 修了樣式問題
# mno7890 完成登錄功能

# 對最近 5 個提交進行交互式 rebase
git rebase -i HEAD~5
```

執行後會打開編輯器：

```bash
# 這是 Git 打開的編輯器內容
# p, pick = 使用該提交
# r, reword = 使用該提交，但修改提交信息
# s, squash = 與前一個提交合並
# f, fixup = 與前一個合併，丟棄提交信息
# d, drop = 刪除該提交

pick abc1234 WIP: 登錄表單
pick def5678 修了個 typo
pick ghi9012 WIP: 接入接口
pick jkl3456 修了樣式問題
pick mno7890 完成登錄功能

# 修改為：
pick abc1234 feat: 添加登錄頁面和表單驗證
fixup def5678 修了個 typo
fixup ghi9012 WIP: 接入接口
fixup jkl3456 修了樣式問題
fixup mno7890 完成登錄功能

# 結果：5 個提交合併為 1 個乾淨的提交
# "feat: 添加登錄頁面和表單驗證"
```

```bash
# 整理完後推送到遠程（需要 force push，因為改寫了歷史）
git push --force-with-lease origin feature/user-login
# --force-with-lease 比 --force 安全：
# 如果遠程有你不知道的新提交，push 會失敗而不是覆蓋它們
```

## Conventional Commits：規範提交信息

團隊協作中，提交信息是最重要的溝通載體。Conventional Commits 是目前最廣泛採用的規範：

```
<type>(<scope>): <subject>

<body>

<footer>
```

```bash
# type 類型（必選）
feat:     新功能
fix:      修復 bug
docs:     文檔變更
style:    代碼格式（不影響功能的變更：空格、格式化、缺少分號等）
refactor: 重構（不是新功能，也不是修復 bug）
perf:     性能優化
test:     添加或修改測試
chore:    構建過程或輔助工具的變更
ci:       CI 配置變更
revert:   回滾提交

# scope（可選）：影響範圍，如模塊名、組件名
# subject（必選）：簡短描述，不超過 50 個字符，不加句號

# ✅ 好的提交信息
git commit -m "feat(login): 添加手機號登錄功能"
git commit -m "fix(cart): 修復數量為0時仍可提交訂單的問題"
git commit -m "refactor(utils): 重構日期格式化函數，支持時區"
git commit -m "perf(list): 虛擬列表優化，萬級數據滾動卡頓降低80%"

# ❌ 差的提交信息
git commit -m "update"
git commit -m "fix bug"
git commit -m "修改"
git commit -m "代碼調整"
git commit -m "週五下班前提交"

# 帶 body 和 footer 的詳細提交
git commit -m "fix(auth): 修復 token 過期後未跳轉登錄頁的問題

當 token 過期時，接口返回 401，
但 axios 攔截器未正確處理該狀態碼，
導致頁面停留在原地且無任何提示。

解決方案：
- 添加 401 響應攔截
- 清除本地存儲的過期 token
- 跳轉到登錄頁並攜帶 redirect 參數

Closes #234"
```

配置 commitlint 自動檢查提交信息：

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // type 必須是以下之一
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style',
      'refactor', 'perf', 'test', 'chore', 'ci', 'revert'
    ]],
    // subject 不超過 50 個字符
    'subject-max-length': [2, 'always', 50],
    // subject 不能以句號結尾
    'subject-full-stop': [2, 'never', '.'],
    // type 後面要有空格
    'type-empty': [2, 'never'],
  },
};
```

```json
// package.json 配合 husky 使用
{
  "husky": {
    "hooks": {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS",
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "git add"
    ],
    "*.{css,less,scss}": [
      "stylelint --fix",
      "git add"
    ]
  }
}
```

## Code Review 與 Pull Request

PR 不只是「合併代碼」的工具，更是團隊知識共享和質量把控的關卡：

```bash
# 完整的 PR 流程

# 1. 從最新的 main 創建功能分支
git checkout main
git pull origin main
git checkout -b feature/order-export

# 2. 開發，提交
git add .
git commit -m "feat(order): 添加訂單導出為 Excel 功能"

# 3. 推送到遠程
git push -u origin feature/order-export

# 4. 在 GitHub/GitLab 上創建 Pull Request
# 標題：feat(order): 添加訂單導出功能
# 描述模板：
```

```markdown
## 變更説明
添加了訂單列表的 Excel 導出功能，支持按時間範圍篩選。

## 變更類型
- [x] 新功能
- [ ] Bug 修復
- [ ] 重構
- [ ] 其他

## 測試情況
- [x] 本地測試通過
- [x] 單元測試已添加
- [ ] E2E 測試已添加

## 截圖/錄屏
（如有 UI 變更，請附截圖）

## 關聯 Issue
Closes #456
```

```bash
# 5. Reviewer 審查代碼後提出修改意見

# 6. 根據 review 意見修改代碼，追加提交
git add .
git commit -m "fixup: 根據 review 意見調整導出邏輯"
# 注意：在合入 main 前，可以把 fixup 提交用交互式 rebase 合併

# 7. 審查通過後，Squash and Merge（推薦）
# 將功能分支的所有提交壓縮成一個提交合入 main
# 保持 main 的歷史乾淨

# 8. 刪除已合併的功能分支
git branch -d feature/order-export
git push origin --delete feature/order-export
```

## .gitignore 最佳實踐

`.gitignore` 看似簡單，但配置不好會導致敏感文件或大文件被提交到倉庫：

```ini
# .gitignore

# ===== 依賴目錄 =====
node_modules/
bower_components/
vendor/

# ===== 構建產物 =====
dist/
build/
coverage/
*.min.js
*.min.css

# ===== 環境配置（可能含密鑰）=====
.env
.env.local
.env.*.local

# ===== IDE / 編輯器 =====
.idea/
.vscode/
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# ===== 日誌 =====
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ===== 測試/臨時文件 =====
.nyc_output/
.cache/
tmp/

# ===== 操作系統 =====
.DS_Store
Thumbs.db
desktop.ini
```

```bash
# 一個常見的坑：文件已經被提交到 Git 後再加 .gitignore 不會生效
# 需要先從 Git 中移除緩存

# 場景：.env 文件被誤提交了
# 1. 先把 .env 加入 .gitignore
echo ".env" >> .gitignore

# 2. 從 Git 追蹤中移除（但不刪除本地文件）
git rm --cached .env

# 3. 提交這個變更
git commit -m "chore: 從版本控制中移除 .env 文件"

# ⚠️ 注意：這只是從未來的提交中移除。
# .env 的內容仍然存在於 Git 歷史中！
# 如果 .env 含有真實密鑰，需要立即輪換密鑰。
# 如果必須從歷史中清除，需要使用 git filter-branch 或 BFG Repo-Cleaner。
```

## 實用 Git 別名

最後分享一些提升效率的 Git 別名配置：

```bash
# ~/.gitconfig 或項目中的 .git/config
[alias]
  # 常用狀態和日誌
  s = status -sb
  lg = log --oneline --graph --decorate --all -20

  # 快速提交
  cm = commit -m
  ca = commit --amend --no-edit

  # 分支操作
  co = checkout
  br = branch
  sw = switch

  # 撤銷操作
  undo = reset --soft HEAD~1        # 撤銷最近一次提交，保留更改在暫存區
  discard = checkout -- .           # 丟棄所有工作區更改

  # 同步遠程
  up = !git fetch origin && git rebase origin/main

  # 清理已合併的本地分支
  cleanup = !git branch --merged main | grep -v 'main' | xargs -n 1 git branch -d

  # 查看某個文件的修改歷史
  filelog = log --follow -p --
```

```bash
# 使用示例
git s              # 查看狀態
git lg             # 查看圖形化日誌
git cm "feat: xxx" # 快速提交
git undo           # 撤銷最後一次提交
git up             # 同步遠程 main 並 rebase
```

## 小結

- 分支模型推薦 GitHub Flow 變體，配合清晰的命名規範（`feature/`、`fix/`、`hotfix/`）讓團隊一目瞭然
- 功能分支用 rebase 保持與 main 同步，合入 main 前用交互式 rebase 整理提交歷史，保持線性且有意義的提交記錄
- Conventional Commits 規範提交信息，配合 commitlint 和 husky 自動檢查，為 changelog 生成和版本管理打好基礎
- PR 是代碼質量的關卡，善用描述模板和 Squash and Merge 策略
- `.gitignore` 要在項目初始化時配好，已提交的文件需要 `git rm --cached` 後才能被忽略
