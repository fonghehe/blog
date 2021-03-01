---
title: "前端工程化：Git 工作流规范"
date: 2018-03-27 10:12:36
tags:
  - 工程化
---

团队协作里 Git 工作流是个容易被忽视的基础设施，但乱了之后非常痛苦。整理一套适合前端团队的规范。

## Git Flow 基础

主流的 Git Flow 包含以下分支：

```
main          生产环境，永远是稳定可发布的状态
develop       开发主干，集成所有功能
feature/*     功能开发分支
release/*     发布准备分支
hotfix/*      紧急修复分支
```

### 日常开发流程

```bash
# 1. 从 develop 拉出功能分支
git checkout develop
git pull origin develop
git checkout -b feature/user-profile

# 2. 开发、提交
git add .
git commit -m "feat: add user profile page"

# 3. 完成后合并回 develop（推荐用 PR/MR 方式）
git checkout develop
git merge --no-ff feature/user-profile  # --no-ff 保留合并记录
git push origin develop

# 4. 删除功能分支
git branch -d feature/user-profile
```

## Commit Message 规范

统一的 commit message 让 `git log` 一眼看出每次提交做了什么，也能自动生成 changelog。

**格式：**

```
<type>(<scope>): <description>

[可选 body]

[可选 footer]
```

**type 类型：**

| type       | 含义                         |
| ---------- | ---------------------------- |
| `feat`     | 新功能                       |
| `fix`      | Bug 修复                     |
| `docs`     | 文档更新                     |
| `style`    | 代码格式（不影响逻辑）       |
| `refactor` | 重构（不是 feat 也不是 fix） |
| `perf`     | 性能优化                     |
| `test`     | 测试相关                     |
| `chore`    | 构建/工具/依赖更新           |
| `revert`   | 回滚                         |

**好的例子：**

```
feat(auth): add login with Google OAuth
fix(table): correct pagination when deleting last item on page
docs(readme): update deployment instructions
chore(deps): upgrade element-ui to 2.4.11
```

**坏的例子：**

```
update
fix bug
修改
wip
```

## commitlint + husky 强制规范

光靠文档约定不够，用工具强制：

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

提交不符合规范时，husky 会拒绝 commit：

```bash
$ git commit -m "update"
husky > commit-msg (node v10.15.0)
⧗   input: update
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings
```

## lint-staged：提交前检查代码

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

这样只检查本次提交的文件，速度快，不影响整个项目的 lint。

## 版本号管理

语义化版本（Semantic Versioning）：`MAJOR.MINOR.PATCH`

- `MAJOR`：不兼容的 API 变化（1.0.0 → 2.0.0）
- `MINOR`：向后兼容的新功能（1.0.0 → 1.1.0）
- `PATCH`：向后兼容的 Bug 修复（1.0.0 → 1.0.1）

```bash
# 用 npm version 命令自动更新版本
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

## 常用 Git 操作

```bash
# 查看图形化日志
git log --oneline --graph --all

# 撤销最后一次提交（保留文件改动）
git reset --soft HEAD~1

# 撤销某个文件的修改
git checkout -- src/components/Button.vue

# 暂存当前工作
git stash save "WIP: 用户页面修改"
git stash pop  # 恢复

# 合并某个 commit 到当前分支
git cherry-pick abc1234

# 交互式 rebase（整理 commit 历史）
git rebase -i HEAD~3
```

## .gitignore 模板

```gitignore
# 依赖
node_modules/

# 构建产物
dist/
build/

# 环境变量
.env.local
.env.*.local

# 编辑器
.DS_Store
.vscode/settings.json
*.swp
*.swo

# 日志
*.log
npm-debug.log*
yarn-debug.log*

# 测试覆盖率
coverage/
```

## 小结

- Git Flow 提供了清晰的分支策略
- commit message 规范让历史可读，能自动生成 changelog
- `husky + commitlint + lint-staged` 三件套是工程化标配
- 小步提交，每个 commit 只做一件事
