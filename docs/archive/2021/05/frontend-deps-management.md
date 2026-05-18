---
title: "前端依赖管理最佳实践"
date: 2021-05-24 17:22:07
tags:
  - 前端
  - 工程化
readingTime: 2
description: "今年处理了好几次因为依赖问题导致的线上事故：版本升级导致的兼容性问题、lockfile 冲突导致的构建差异、依赖安全漏洞。总结一下在团队中管理前端依赖的经验。"
---

今年处理了好几次因为依赖问题导致的线上事故：版本升级导致的兼容性问题、lockfile 冲突导致的构建差异、依赖安全漏洞。总结一下在团队中管理前端依赖的经验。

## 版本锁定策略

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

我们的策略：

```
核心依赖（Vue、React、TypeScript）：^ 精确到 major.minor
工具依赖（ESLint、Prettier）：^ 允许 minor 更新
有兼容性风险的库：~ 或精确版本
```

## Lockfile 管理

Lockfile 冲突是团队协作中最常见的问题：

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

## 安全审计

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

## 依赖清理

项目依赖会随时间膨胀，需要定期清理：

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

更严格的方案是在 CI 中集成检查：

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

## Monorepo 中的依赖管理

pnpm workspace 的依赖管理尤其需要注意：

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

## 依赖升级流程

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

## 小结

- 版本号策略要团队统一，核心依赖用 `^` 精确到 minor
- Lockfile 冲突不要手动解决，重新生成是更好的做法
- `npm audit` 要集成到 CI，高危漏洞阻止发布
- 定期用 depcheck 清理未使用的依赖
- Monorepo 中依赖管理更复杂，需要用 pnpm 的 overrides 和 peerDependencies
- 依赖管理的核心原则：可重复构建、安全、不过时