---
title: "前端依賴管理最佳實踐：落地路徑與實戰建議"
date: 2021-05-24 17:22:07
tags:
  - 前端
  - 工程化
readingTime: 2
description: "今年處理了好幾次因為依賴問題導致的線上事故：版本升級導致的相容性問題、lockfile 衝突導致的構建差異、依賴安全漏洞。總結一下在團隊中管理前端依賴的經驗。"
wordCount: 273
---

今年處理了好幾次因為依賴問題導致的線上事故：版本升級導致的兼容性問題、lockfile 衝突導致的構建差異、依賴安全漏洞。總結一下在團隊中管理前端依賴的經驗。

## 版本鎖定策略

```json
// package.json 中版本號的含義
{
  "dependencies": {
    // ~1.2.3 允許 1.2.x 的最新 patch
    // ^1.2.3 允許 1.x.x 的最新 minor（npm/yarn 默認）
    // 1.2.3  精確鎖定

    "vue": "^3.2.0",
    "vue-router": "^4.0.0",
    "lodash-es": "~4.17.21"  // lodash 用 ~，避免 minor 變化
  }
}
```

我們的策略：

```
核心依賴（Vue、React、TypeScript）：^ 精確到 major.minor
工具依賴（ESLint、Prettier）：^ 允許 minor 更新
有兼容性風險的庫：~ 或精確版本
```

## Lockfile 管理

Lockfile 衝突是團隊協作中最常見的問題：

```bash
# 原則一：lockfile 必須提交到 Git
# npm: package-lock.json
# yarn: yarn.lock
# pnpm: pnpm-lock.yaml

# 原則二：lockfile 衝突的正確處理
# 不要手動解決 lockfile 衝突
# 正確做法：
git checkout --theirs pnpm-lock.yaml
pnpm install  # 重新生成 lockfile
git add pnpm-lock.yaml

# 原則三：定期更新，不要積累太多版本差
pnpm update --interactive --latest
```

## 安全審計

```bash
# npm 內置的安全審計
npm audit

# 自動修復
npm audit fix

# 僅修復 production 依賴
npm audit fix --only=prod

# pnpm 的安全審計
pnpm audit

# 定期在 CI 中檢查
# .gitlab-ci.yml
security-audit:
  script:
    - pnpm audit --audit-level=high
  allow_failure: false  # 高危漏洞阻止發佈
```

## 依賴清理

項目依賴會隨時間膨脹，需要定期清理：

```bash
# 找出未使用的依賴
npx depcheck

# 輸出示例：
# Unused dependencies
# * lodash-es
# * moment

# Unused devDependencies
# * @types/jest

# 手動確認後移除
pnpm uninstall lodash-es moment
```

更嚴格的方案是在 CI 中集成檢查：

```javascript
// scripts/check-deps.js
const { execSync } = require('child_process')
const depcheck = require('depcheck')

depcheck(process.cwd(), {
  ignoreMatches: [
    'vite',      // Vite 通過插件引用
    '@types/*'   // 類型定義
  ]
}).then((result) => {
  if (result.dependencies.length > 0) {
    console.error('發現未使用的依賴:', result.dependencies)
    process.exit(1)
  }
})
```

## Monorepo 中的依賴管理

pnpm workspace 的依賴管理尤其需要注意：

```json
// 根目錄 package.json
{
  "pnpm": {
    // 全局覆蓋某些包的版本
    "overrides": {
      "typescript": "~4.5.0"
    },
    // 某些包需要完全提升（相容性問題）
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
    "@company/icons": "workspace:*",    // 引用同倉庫的 icons 包
    "vue": "^3.2.0"
  },
  "peerDependencies": {
    "vue": "^3.2.0"
  }
}
```

## 依賴升級流程

```
1. 檢查過時依賴
   pnpm outdated

2. 查看變更日誌
   重點看 breaking changes

3. 本地測試升級
   pnpm update <package>

4. 運行測試
   pnpm test

5. 代碼審查
   提交 PR，重點看 lockfile 變化

6. 灰度驗證
   先部署到測試環境
```

## 小結

- 版本號策略要團隊統一，核心依賴用 `^` 精確到 minor
- Lockfile 衝突不要手動解決，重新生成是更好的做法
- `npm audit` 要集成到 CI，高危漏洞阻止發佈
- 定期用 depcheck 清理未使用的依賴
- Monorepo 中依賴管理更復雜，需要用 pnpm 的 overrides 和 peerDependencies
- 依賴管理的核心原則：可重複構建、安全、不過時