---
title: "团队 Git 工作流最佳实践"
date: 2019-06-13 14:43:48
tags:
  - 工程化
---

个人写代码，Git 随便用都行。但团队协作就不一样了——分支怎么管理、提交信息怎么写、代码怎么审查，每个环节没有规范就会乱。这篇文章整理了我在实际团队中验证过的工作流实践。

## Git Flow vs GitHub Flow

两种主流的分支模型，各有适用场景：

**Git Flow**——适合有明确发布周期的项目（如 App 版本发布）：

```
main (master) ← 只有版本发布时才打 tag
  ↑
release/v1.2.0 ← 发布前的准备分支，只修 bug
  ↑
develop ← 日常开发的集成分支
  ↑    ↑
feature/login  feature/payment ← 功能分支
```

**GitHub Flow**——适合持续部署的项目（如 SaaS、Web 应用）：

```
main ← 随时可部署
  ↑
feature/xxx ← 从 main 创建，完成后 PR 合回 main
```

2019 年大多数前端团队用的是 GitHub Flow 的变体，因为 Web 项目通常持续部署，不需要复杂的 release 分支。

## 分支命名规范

混乱的分支命名是协作的第一道坎。统一命名规范可以让团队一眼看出分支用途：

```bash
# 分支命名格式：类型/简短描述
# 类型常用：feature、fix、hotfix、release、chore

# ✅ 好的命名
git checkout -b feature/user-login
git checkout -b feature/order-list-pagination
git checkout -b fix/cart-calculation-error
git checkout -b hotfix/production-crash-0601
git checkout -b release/v2.3.0
git checkout -b chore/upgrade-webpack-4

# ❌ 差的命名
git checkout -b dev           # dev 是什么？
git checkout -b test          # 测试什么？
git checkout -b my-branch     # 你的分支，别人看不懂
git checkout -b fix-bug       # 什么 bug？
git checkout -b 0601          # 数字是什么意思？
```

可以在项目中配置分支命名检查（配合 husky）：

```bash
#!/bin/sh
# .git/hooks/pre-push 或通过 husky 配置
branch=$(git rev-parse --abbrev-ref HEAD)
valid_pattern="^(feature|fix|hotfix|release|chore)/[a-z0-9._-]+$"

if ! echo "$branch" | grep -qE "$valid_pattern"; then
  echo "分支名 '$branch' 不符合规范"
  echo "正确格式: feature|fix|hotfix|release|chore/描述"
  echo "示例: feature/user-login"
  exit 1
fi
```

## Rebase vs Merge：保持线性历史

这是团队中讨论最多的 Git 话题之一。核心区别：

```bash
# 场景：你在 feature/login 上开发，main 上有新的提交

# === Merge 方式 ===
# 把 main 的变更合并到你的分支，产生一个合并提交
git checkout feature/login
git merge main
# 结果：多了一个 merge commit，历史出现分叉又汇合

# === Rebase 方式 ===
# 把你的提交「搬到」main 的最新提交之后
git checkout feature/login
git rebase main
# 结果：线性历史，没有多余的 merge commit
```

```
Merge 历史（有分叉）：
*   Merge branch 'main' into feature/login
|\
| * fix: 更新了配置文件
* | feat: 添加登录页面
|/
* chore: 更新依赖
* feat: 初始化项目

Rebase 历史（线性）：
* feat: 添加登录页面
* fix: 更新了配置文件
* chore: 更新依赖
* feat: 初始化项目
```

实际团队中的建议：

```bash
# 功能分支开发过程中：用 rebase 同步 main 的最新代码
git checkout feature/user-login
git fetch origin
git rebase origin/main

# 如果 rebase 过程中有冲突，解决后继续
git add .
git rebase --continue

# 如果 rebase 搞乱了想放弃，可以随时回退
git rebase --abort

# ⚠️ 黄金规则：永远不要 rebase 已经推送到远程的公共分支！
# 只 rebase 你自己独占的功能分支。
# 如果你和同事共享 feature 分支，不要 rebase。
```

## 交互式 Rebase：整理提交历史

功能开发完准备合入 main 之前，用交互式 rebase 把乱七八糟的提交整理成有意义的几个提交：

```bash
# 假设你的功能分支有 5 个提交
git log --oneline feature/user-login
# abc1234 WIP: 登录表单
# def5678 修了个 typo
# ghi9012 WIP: 接入接口
# jkl3456 修了样式问题
# mno7890 完成登录功能

# 对最近 5 个提交进行交互式 rebase
git rebase -i HEAD~5
```

执行后会打开编辑器：

```bash
# 这是 Git 打开的编辑器内容
# p, pick = 使用该提交
# r, reword = 使用该提交，但修改提交信息
# s, squash = 与前一个提交合并
# f, fixup = 与前一个合并，丢弃提交信息
# d, drop = 删除该提交

pick abc1234 WIP: 登录表单
pick def5678 修了个 typo
pick ghi9012 WIP: 接入接口
pick jkl3456 修了样式问题
pick mno7890 完成登录功能

# 修改为：
pick abc1234 feat: 添加登录页面和表单验证
fixup def5678 修了个 typo
fixup ghi9012 WIP: 接入接口
fixup jkl3456 修了样式问题
fixup mno7890 完成登录功能

# 结果：5 个提交合并为 1 个干净的提交
# "feat: 添加登录页面和表单验证"
```

```bash
# 整理完后推送到远程（需要 force push，因为改写了历史）
git push --force-with-lease origin feature/user-login
# --force-with-lease 比 --force 安全：
# 如果远程有你不知道的新提交，push 会失败而不是覆盖它们
```

## Conventional Commits：规范提交信息

团队协作中，提交信息是最重要的沟通载体。Conventional Commits 是目前最广泛采用的规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

```bash
# type 类型（必选）
feat:     新功能
fix:      修复 bug
docs:     文档变更
style:    代码格式（不影响功能的变更：空格、格式化、缺少分号等）
refactor: 重构（不是新功能，也不是修复 bug）
perf:     性能优化
test:     添加或修改测试
chore:    构建过程或辅助工具的变更
ci:       CI 配置变更
revert:   回滚提交

# scope（可选）：影响范围，如模块名、组件名
# subject（必选）：简短描述，不超过 50 个字符，不加句号

# ✅ 好的提交信息
git commit -m "feat(login): 添加手机号登录功能"
git commit -m "fix(cart): 修复数量为0时仍可提交订单的问题"
git commit -m "refactor(utils): 重构日期格式化函数，支持时区"
git commit -m "perf(list): 虚拟列表优化，万级数据滚动卡顿降低80%"

# ❌ 差的提交信息
git commit -m "update"
git commit -m "fix bug"
git commit -m "修改"
git commit -m "代码调整"
git commit -m "周五下班前提交"

# 带 body 和 footer 的详细提交
git commit -m "fix(auth): 修复 token 过期后未跳转登录页的问题

当 token 过期时，接口返回 401，
但 axios 拦截器未正确处理该状态码，
导致页面停留在原地且无任何提示。

解决方案：
- 添加 401 响应拦截
- 清除本地存储的过期 token
- 跳转到登录页并携带 redirect 参数

Closes #234"
```

配置 commitlint 自动检查提交信息：

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // type 必须是以下之一
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style',
      'refactor', 'perf', 'test', 'chore', 'ci', 'revert'
    ]],
    // subject 不超过 50 个字符
    'subject-max-length': [2, 'always', 50],
    // subject 不能以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // type 后面要有空格
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

## Code Review 与 Pull Request

PR 不只是「合并代码」的工具，更是团队知识共享和质量把控的关卡：

```bash
# 完整的 PR 流程

# 1. 从最新的 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feature/order-export

# 2. 开发，提交
git add .
git commit -m "feat(order): 添加订单导出为 Excel 功能"

# 3. 推送到远程
git push -u origin feature/order-export

# 4. 在 GitHub/GitLab 上创建 Pull Request
# 标题：feat(order): 添加订单导出功能
# 描述模板：
```

```markdown
## 变更说明
添加了订单列表的 Excel 导出功能，支持按时间范围筛选。

## 变更类型
- [x] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 其他

## 测试情况
- [x] 本地测试通过
- [x] 单元测试已添加
- [ ] E2E 测试已添加

## 截图/录屏
（如有 UI 变更，请附截图）

## 关联 Issue
Closes #456
```

```bash
# 5. Reviewer 审查代码后提出修改意见

# 6. 根据 review 意见修改代码，追加提交
git add .
git commit -m "fixup: 根据 review 意见调整导出逻辑"
# 注意：在合入 main 前，可以把 fixup 提交用交互式 rebase 合并

# 7. 审查通过后，Squash and Merge（推荐）
# 将功能分支的所有提交压缩成一个提交合入 main
# 保持 main 的历史干净

# 8. 删除已合并的功能分支
git branch -d feature/order-export
git push origin --delete feature/order-export
```

## .gitignore 最佳实践

`.gitignore` 看似简单，但配置不好会导致敏感文件或大文件被提交到仓库：

```ini
# .gitignore

# ===== 依赖目录 =====
node_modules/
bower_components/
vendor/

# ===== 构建产物 =====
dist/
build/
coverage/
*.min.js
*.min.css

# ===== 环境配置（可能含密钥）=====
.env
.env.local
.env.*.local

# ===== IDE / 编辑器 =====
.idea/
.vscode/
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# ===== 日志 =====
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ===== 测试/临时文件 =====
.nyc_output/
.cache/
tmp/

# ===== 操作系统 =====
.DS_Store
Thumbs.db
desktop.ini
```

```bash
# 一个常见的坑：文件已经被提交到 Git 后再加 .gitignore 不会生效
# 需要先从 Git 中移除缓存

# 场景：.env 文件被误提交了
# 1. 先把 .env 加入 .gitignore
echo ".env" >> .gitignore

# 2. 从 Git 追踪中移除（但不删除本地文件）
git rm --cached .env

# 3. 提交这个变更
git commit -m "chore: 从版本控制中移除 .env 文件"

# ⚠️ 注意：这只是从未来的提交中移除。
# .env 的内容仍然存在于 Git 历史中！
# 如果 .env 含有真实密钥，需要立即轮换密钥。
# 如果必须从历史中清除，需要使用 git filter-branch 或 BFG Repo-Cleaner。
```

## 实用 Git 别名

最后分享一些提升效率的 Git 别名配置：

```bash
# ~/.gitconfig 或项目中的 .git/config
[alias]
  # 常用状态和日志
  s = status -sb
  lg = log --oneline --graph --decorate --all -20

  # 快速提交
  cm = commit -m
  ca = commit --amend --no-edit

  # 分支操作
  co = checkout
  br = branch
  sw = switch

  # 撤销操作
  undo = reset --soft HEAD~1        # 撤销最近一次提交，保留更改在暂存区
  discard = checkout -- .           # 丢弃所有工作区更改

  # 同步远程
  up = !git fetch origin && git rebase origin/main

  # 清理已合并的本地分支
  cleanup = !git branch --merged main | grep -v 'main' | xargs -n 1 git branch -d

  # 查看某个文件的修改历史
  filelog = log --follow -p --
```

```bash
# 使用示例
git s              # 查看状态
git lg             # 查看图形化日志
git cm "feat: xxx" # 快速提交
git undo           # 撤销最后一次提交
git up             # 同步远程 main 并 rebase
```

## 小结

- 分支模型推荐 GitHub Flow 变体，配合清晰的命名规范（`feature/`、`fix/`、`hotfix/`）让团队一目了然
- 功能分支用 rebase 保持与 main 同步，合入 main 前用交互式 rebase 整理提交历史，保持线性且有意义的提交记录
- Conventional Commits 规范提交信息，配合 commitlint 和 husky 自动检查，为 changelog 生成和版本管理打好基础
- PR 是代码质量的关卡，善用描述模板和 Squash and Merge 策略
- `.gitignore` 要在项目初始化时配好，已提交的文件需要 `git rm --cached` 后才能被忽略
