---
title: "Frontend Dependency Management Best Practices"
date: 2021-05-24 17:22:07
tags:
  - Engineering
  - Frontend

readingTime: 2
description: "This year I handled several production incidents caused by dependencies: compatibility breaks from version upgrades, build discrepancies from lockfile conflicts, and dependency security vulnerabilities. Here's a summary of how our team manages frontend dependencies."
wordCount: 170
---

This year we've dealt with several production incidents caused by dependency issues: compatibility problems from version upgrades, build differences from lockfile conflicts, and vulnerable dependencies. Here's a summary of our experience managing frontend dependencies on the team.

## Version Locking Strategy

```json
// package.json 中版本号的含义
{
  "dependencies": {
    // ~1.2.3 允许 1.2.x 的最新 patch
    // ^1.2.3 允许 1.x.x 的最新 minor（npm/yarn 默认）
    // 1.2.3  精确锁定

    "vue": "^3.2.0",
    "vue-router": "^4.0.0",
    "lodash-es": "~4.17.21"  // lodash 用 ~，避免 minor 变化
  }
}
```

Our strategy:

```
核心依赖（Vue、React、TypeScript）：^ 精确到 major.minor
工具依赖（ESLint、Prettier）：^ 允许 minor 更新
有兼容性风险的库：~ 或精确版本
```

## Lockfile Management

Lockfile conflicts are the most common issue in team collaboration:

```bash
# 原则一：lockfile 必须提交到 Git
# npm: package-lock.json
# yarn: yarn.lock
# pnpm: pnpm-lock.yaml

# 原则二：lockfile 冲突的正确处理
# 不要手动解决 lockfile 冲突
# 正确做法：
git checkout --theirs pnpm-lock.yaml
pnpm install  # 重新生成 lockfile
git add pnpm-lock.yaml

# 原则三：定期更新，不要积累太多版本差
pnpm update --interactive --latest
```

## Security Audit

```bash
# npm 内置的安全审计
npm audit

# 自动修复
npm audit fix

# 仅修复 production 依赖
npm audit fix --only=prod

# pnpm 的安全审计
pnpm audit

# 定期在 CI 中检查
# .gitlab-ci.yml
security-audit:
  script:
    - pnpm audit --audit-level=high
  allow_failure: false  # 高危漏洞阻止发布
```

## Dependency Cleanup

Project dependencies tend to bloat over time and need periodic cleanup:

```bash
# 找出未使用的依赖
npx depcheck

# 输出示例：
# Unused dependencies
# * lodash-es
# * moment

# Unused devDependencies
# * @types/jest

# 手动确认后移除
pnpm uninstall lodash-es moment
```

A stricter approach is to add the check to CI:

```javascript
// scripts/check-deps.js
const { execSync } = require('child_process')
const depcheck = require('depcheck')

depcheck(process.cwd(), {
  ignoreMatches: [
    'vite',      // Vite 通过插件引用
    '@types/*'   // 类型定义
  ]
}).then((result) => {
  if (result.dependencies.length > 0) {
    console.error('发现未使用的依赖:', result.dependencies)
    process.exit(1)
  }
})
```

## Dependency Management in Monorepo

Dependency management in a pnpm workspace deserves special attention:

```json
// 根目录 package.json
{
  "pnpm": {
    // 全局覆盖某些包的版本
    "overrides": {
      "typescript": "~4.5.0"
    },
    // 某些包需要完全提升（兼容性问题）
    "publicHoistPattern": [
      "*eslint*",
      "*prettier*"
    ]
  }
}

// 子包中引用其他子包
// packages/button/package.json
{
  "dependencies": {
    "@company/icons": "workspace:*",    // 引用同仓库的 icons 包
    "vue": "^3.2.0"
  },
  "peerDependencies": {
    "vue": "^3.2.0"
  }
}
```

## Dependency Upgrade Process

```
1. 检查过时依赖
   pnpm outdated

2. 查看变更日志
   重点看 breaking changes

3. 本地测试升级
   pnpm update <package>

4. 运行测试
   pnpm test

5. 代码审查
   提交 PR，重点看 lockfile 变化

6. 灰度验证
   先部署到测试环境
```

## Summary

- Agree on a versioning policy as a team; pin core dependencies with `^` down to the minor version
- Don't resolve lockfile conflicts by hand; regenerating it is the better approach
- Wire `npm audit` into CI and block releases on high-severity vulnerabilities
- Periodically clean up unused dependencies with depcheck
- Dependency management in a monorepo is more complex; you'll need pnpm's overrides and peerDependencies
- The core principles of dependency management: reproducible builds, security, and staying current