---
title: "組件庫版本管理：Monorepo 中的發佈策略"
date: 2022-08-23 14:31:47
tags:
  - 前端
readingTime: 2
description: "在 pnpm + Turborepo 的 monorepo 中管理組件庫版本是個實際問題。什麼時候發 patch、什麼時候發 minor、怎麼生成 changelog、怎麼處理 breaking change？這篇文章講講我們團隊的實踐。"
wordCount: 321
---

在 pnpm + Turborepo 的 monorepo 中管理組件庫版本是個實際問題。什麼時候發 patch、什麼時候發 minor、怎麼生成 changelog、怎麼處理 breaking change？這篇文章講講我們團隊的實踐。

## 版本策略：SemVer

```json
// packages/ui-components/package.json
{
  "name": "@mono/ui-components",
  "version": "1.5.2",
  "publishConfig": {
    "access": "public"
  }
}
```

規則：
- **patch** (1.5.2 -> 1.5.3)：Bug 修復，不改 API
- **minor** (1.5.2 -> 1.6.0)：新增功能，向後兼容
- **major** (1.5.2 -> 2.0.0)：破壞性變更

## Changesets：自動化版本管理

```bash
pnpm add -D -w @changesets/cli
```

```bash
# 初始化
pnpm changeset init
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@2.3.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [
    ["@mono/ui-components", "@mono/ui-docs"]
  ],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@mono/eslint-config", "@mono/ts-config"]
}
```

`linked` 表示這兩個包一起發版——組件庫更新時文檔站也 bump 版本。

## 日常開發流程

```bash
# 開發一個新功能
git checkout -b feat/add-date-picker

# ... 寫代碼 ...

# 提交前創建 changeset
pnpm changeset

# 交互式選擇：
# ? Which packages have changed?
#   ◉ @mono/ui-components
#   ◯ @mono/utils
#   ◯ @mono/admin
# ? Is this a major/minor/patch?
#   ◯ major
#   ◉ minor
#   ◯ patch
# ? Summary: 新增 DatePicker 組件
```

生成文件 `.changeset/xxxx-add-date-picker.md`：

```markdown
---
"@mono/ui-components": minor
---

新增 DatePicker 組件
```

這個文件跟着 PR 一起提交。

## CI 自動發版

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2
        with:
          version: 7

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm turbo run build

      - name: Test
        run: pnpm turbo run test

      # 創建版本 PR 或直接發佈
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

流程：合併 PR 到 main -> Changesets 檢測到有 changeset 文件 -> 自動創建「Version Packages」PR -> 合併後自動發佈到 npm。

## BREAKING CHANGE 的處理

```markdown
---
"@mono/ui-components": major
---

BREAKING CHANGE: Button 組件的 variant 屬性值從字符串改為枚舉

- `variant="primary"` 改為 `variant={ButtonVariant.Primary}`
- `variant="danger"` 改為 `variant={ButtonVariant.Danger}`
- 移除了 `variant="default"`，改用 `variant={ButtonVariant.Outline}`
```

升級指南單獨寫一個遷移文檔，changeset 裏簡要説明。

## 依賴關係中的版本同步

```json
// packages/ui-components/package.json
{
  "name": "@mono/ui-components",
  "version": "1.5.2",
  "dependencies": {
    "@mono/utils": "workspace:*"
  }
}

// apps/admin/package.json
{
  "dependencies": {
    "@mono/ui-components": "workspace:*",
    "@mono/utils": "workspace:*"
  }
}
```

`workspace:*` 確保始終用本地版本。發佈時 Changesets 自動替換為實際版本號。

## Changelog 生成

```markdown
# @mono/ui-components

## 1.6.0

### Minor Changes

- abc123: 新增 DatePicker 組件
- def456: Button 新增 loading 狀態

### Patch Changes

- ghi789: 修復 Modal 關閉後焦點未恢復的問題
- Updated dependencies
  - @mono/utils@1.3.1
```

## 版本號的管理哲學

```typescript
// 我們的約定：

// 工具包：嚴格 SemVer
"@mono/utils": "1.2.3"      // patch/minor/major

// 組件庫：嚴格 SemVer + CHANGELOG
"@mono/ui-components": "2.1.0"

// 應用：不需要發佈，內部版本
"admin": "0.0.0"             // 永遠 0.0.0

// 配置包：patch 升級即可
"@mono/eslint-config": "1.0.5"
```

## 與 Turborepo 配合

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "version": {
      "cache": false
    },
    "publish": {
      "cache": false,
      "dependsOn": ["build"]
    }
  }
}
```

## 小結

Changesets 是目前 monorepo 版本管理的最佳方案。它把「什麼時候發版」和「發什麼版本」的問題自動化了。配合 CI，開發者只需要在 PR 中創建 changeset，剩下的全自動。