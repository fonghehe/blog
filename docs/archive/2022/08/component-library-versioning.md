---
title: "组件库版本管理：Monorepo 中的发布策略"
date: 2022-08-23 14:31:47
tags:
  - 前端
readingTime: 2
description: "在 pnpm + Turborepo 的 monorepo 中管理组件库版本是个实际问题。什么时候发 patch、什么时候发 minor、怎么生成 changelog、怎么处理 breaking change？这篇文章讲讲我们团队的实践。"
wordCount: 321
---

在 pnpm + Turborepo 的 monorepo 中管理组件库版本是个实际问题。什么时候发 patch、什么时候发 minor、怎么生成 changelog、怎么处理 breaking change？这篇文章讲讲我们团队的实践。

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

规则：
- **patch** (1.5.2 -> 1.5.3)：Bug 修复，不改 API
- **minor** (1.5.2 -> 1.6.0)：新增功能，向后兼容
- **major** (1.5.2 -> 2.0.0)：破坏性变更

## Changesets：自动化版本管理

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

`linked` 表示这两个包一起发版——组件库更新时文档站也 bump 版本。

## 日常开发流程

```bash
# 开发一个新功能
git checkout -b feat/add-date-picker

# ... 写代码 ...

# 提交前创建 changeset
pnpm changeset

# 交互式选择：
# ? Which packages have changed?
#   ◉ @mono/ui-components
#   ◯ @mono/utils
#   ◯ @mono/admin
# ? Is this a major/minor/patch?
#   ◯ major
#   ◉ minor
#   ◯ patch
# ? Summary: 新增 DatePicker 组件
```

生成文件 `.changeset/xxxx-add-date-picker.md`：

```markdown
---
"@mono/ui-components": minor
---

新增 DatePicker 组件
```

这个文件跟着 PR 一起提交。

## CI 自动发版

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

      # 创建版本 PR 或直接发布
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

流程：合并 PR 到 main -> Changesets 检测到有 changeset 文件 -> 自动创建「Version Packages」PR -> 合并后自动发布到 npm。

## BREAKING CHANGE 的处理

```markdown
---
"@mono/ui-components": major
---

BREAKING CHANGE: Button 组件的 variant 属性值从字符串改为枚举

- `variant="primary"` 改为 `variant={ButtonVariant.Primary}`
- `variant="danger"` 改为 `variant={ButtonVariant.Danger}`
- 移除了 `variant="default"`，改用 `variant={ButtonVariant.Outline}`
```

升级指南单独写一个迁移文档，changeset 里简要说明。

## 依赖关系中的版本同步

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

`workspace:*` 确保始终用本地版本。发布时 Changesets 自动替换为实际版本号。

## Changelog 生成

```markdown
# @mono/ui-components

## 1.6.0

### Minor Changes

- abc123: 新增 DatePicker 组件
- def456: Button 新增 loading 状态

### Patch Changes

- ghi789: 修复 Modal 关闭后焦点未恢复的问题
- Updated dependencies
  - @mono/utils@1.3.1
```

## 版本号的管理哲学

```typescript
// 我们的约定：

// 工具包：严格 SemVer
"@mono/utils": "1.2.3"      // patch/minor/major

// 组件库：严格 SemVer + CHANGELOG
"@mono/ui-components": "2.1.0"

// 应用：不需要发布，内部版本
"admin": "0.0.0"             // 永远 0.0.0

// 配置包：patch 升级即可
"@mono/eslint-config": "1.0.5"
```

## 与 Turborepo 配合

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

## 小结

Changesets 是目前 monorepo 版本管理的最佳方案。它把「什么时候发版」和「发什么版本」的问题自动化了。配合 CI，开发者只需要在 PR 中创建 changeset，剩下的全自动。