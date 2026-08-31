---
title: "Component Library Versioning: Release Strategies in Monorepo"
date: 2022-08-23 14:31:47
tags:
  - Frontend
readingTime: 2
description: "Managing component library versions in a pnpm + Turborepo monorepo is a real-world challenge. When should you release a patch, when a minor? How do you generate changelogs and handle breaking changes? This article walks through our team's practices."
wordCount: 217
---

Managing component library versions in a pnpm + Turborepo monorepo is a real-world challenge. When should you release a patch, when a minor? How do you generate changelogs and handle breaking changes? This article walks through our team's practices.

## Versioning Strategy: SemVer

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

Rules:
- **patch** (1.5.2 -> 1.5.3): Bug fixes, no API changes
- **minor** (1.5.2 -> 1.6.0): New features, backward compatible
- **major** (1.5.2 -> 2.0.0): Breaking changes

## Changesets: Automated Version Management

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

`linked` means these two packages are versioned together — when the component library updates, the docs site bumps its version too.

## Daily Development Workflow

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

This generates a file `.changeset/xxxx-add-date-picker.md`:

```markdown
---
"@mono/ui-components": minor
---

新增 DatePicker 组件
```

This file is committed along with the PR.

## CI Auto-Publishing

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

Workflow: merge PR to main -> Changesets detects changeset files -> automatically creates a "Version Packages" PR -> auto-publishes to npm after merge.

## Handling BREAKING CHANGEs

```markdown
---
"@mono/ui-components": major
---

BREAKING CHANGE: Button 组件的 variant 属性值从字符串改为枚举

- `variant="primary"` 改为 `variant={ButtonVariant.Primary}`
- `variant="danger"` 改为 `variant={ButtonVariant.Danger}`
- 移除了 `variant="default"`，改用 `variant={ButtonVariant.Outline}`
```

Write a separate migration guide for the upgrade; keep the changeset description brief.

## Version Synchronization in Dependencies

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

`workspace:*` ensures the local version is always used. At publish time, Changesets automatically replaces it with the actual version number.

## Changelog Generation

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

## Version Management Philosophy

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

## Integration with Turborepo

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

## Summary

Changesets is currently the best solution for monorepo version management. It automates the questions of "when to release" and "what version to release." Combined with CI, developers only need to create a changeset in their PR — everything else is fully automated.