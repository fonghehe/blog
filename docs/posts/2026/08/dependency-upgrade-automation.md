---
title: "pnpm Monorepo 依赖自动升级：Renovate 配置与 CI 门禁实战"
date: 2026-08-23 11:31:54
tags:
  - 工程化
  - 安全
readingTime: 8
description: "在 pnpm monorepo 中落地依赖自动升级，不是装个 Renovate 就完事。本文覆盖分组策略、automerge 分级、lockfile-only 更新、CI 门禁（typecheck/测试/bundle size）、breaking change codemod 集成和安全漏洞响应流程，附团队实际推行数据。"
wordCount: 1582
---

去年我们团队的 monorepo 有 12 个 packages、4 个 apps，依赖总数超过 300 个。手动升级依赖的状态是：平均每月花 3 天处理升级 PR，安全漏洞从发布到修复平均 18 天，还时不时因为升级漏改 breaking change 导致线上事故。今年初我们系统性地搭了一套自动升级流水线，三个月后升级耗时降到每月半天，安全漏洞修复周期压到 2 天以内。这篇文章记录完整的配置思路和踩过的坑。

## Renovate 基础配置：monorepo 的特殊考量

pnpm monorepo 的 Renovate 配置和单仓库有几个关键区别：需要识别 workspace 协议、处理内部包版本联动、避免对同一依赖产生多个冲突 PR。

```jsonc
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":automergePatch"
  ],
  // pnpm monorepo 专属设置
  "packageRules": [
    // 内部 workspace 包不通过 Renovate 管理
    {
      "matchPackagePatterns": ["^@our-scope/"],
      "enabled": false
    }
  ],
  // lockfile 维护模式：只更新 lockfile，不改 package.json 的版本范围
  "rangeStrategy": "update-lockfile",
  // 限制并发 PR 数量，避免 CI 被打满
  "prConcurrentLimit": 5,
  // 每周集中创建 PR，减少日常干扰
  "schedule": ["before 9am on Monday"],
  // 时区
  "timezone": "Asia/Shanghai"
}
```

`rangeStrategy: update-lockfile` 是我们选的核心策略。它保持 `package.json` 中的版本范围不变（如 `^3.2.0`），只更新 `pnpm-lock.yaml` 中解析到的具体版本。好处是不会产生大量修改 `package.json` 的 PR，减少了合并冲突；坏处是无法自动升级到新 major——major 需要单独处理，后面会讲。

## 分组策略：减少 PR 噪音的关键

300 个依赖如果每个都单独开 PR，周一早上你会看到 40+ 个待审 PR。分组规则的设计目标是在"独立可审查"和"PR 数量可控"之间找平衡。

```jsonc
"packageRules": [
  // 1. 框架核心：Vue 全家桶一起升
  {
    "groupName": "vue-ecosystem",
    "matchPackagePatterns": [
      "^vue$",
      "^@vue/",
      "^vue-router$",
      "^pinia$",
      "^@unhead/"
    ],
    "groupSlug": "vue-ecosystem",
    "separateMajorMinor": true
  },

  // 2. 构建工具链：Vite + 插件 + Rollup
  {
    "groupName": "build-tools",
    "matchPackagePatterns": [
      "^vite$",
      "^@vitejs/",
      "^rollup$",
      "^@rollup/",
      "^unplugin-"
    ]
  },

  // 3. 测试相关：vitest + testing-library + msw
  {
    "groupName": "testing",
    "matchPackagePatterns": [
      "^vitest$",
      "^@vitest/",
      "^@testing-library/",
      "^msw$"
    ]
  },

  // 4. TypeScript 生态
  {
    "groupName": "typescript",
    "matchPackagePatterns": [
      "^typescript$",
      "^@types/",
      "^tsup$",
      "^tsx$"
    ]
  },

  // 5. lint & format：eslint + prettier + stylelint
  {
    "groupName": "linting",
    "matchPackagePatterns": [
      "^eslint$",
      "^@eslint/",
      "^prettier$",
      "^stylelint"
    ]
  },

  // 6. 其余 patch/minor 归为一组
  {
    "groupName": "misc-patch-minor",
    "matchUpdateTypes": ["patch", "minor"],
    "excludePackagePatterns": [
      "^vue", "^@vue/", "^vue-router$", "^pinia$",
      "^vite$", "^@vitejs/", "^vitest$",
      "^typescript$", "^@types/",
      "^eslint$", "^@eslint/", "^prettier$"
    ]
  }
]
```

分组的粒度取决于你的 review 能力。我们的经验是：同一技术栈的依赖放一组（因为它们经常需要配套升级），不相关的杂项 patch 放一组（因为 patch 风险低，不需要逐个审查）。Major 升级永远单独出 PR，绝不进组。

## Automerge 分级：按风险分层自动合并

不是所有更新都需要人工 review。我们把 automerge 分成三级：

```jsonc
"packageRules": [
  // Tier 1: patch + devDependency → 直接合
  {
    "matchUpdateTypes": ["patch"],
    "matchDepTypes": ["devDependencies"],
    "automerge": true,
    "automergeType": "pr",
    "platformAutomerge": true,
    "requiredStatusChecks": ["ci/typecheck", "ci/test"]
  },

  // Tier 2: minor + devDependency → CI 通过后合
  {
    "matchUpdateTypes": ["minor"],
    "matchDepTypes": ["devDependencies"],
    "automerge": true,
    "automergeType": "pr",
    "platformAutomerge": true,
    "minimumReleaseAge": "3 days",
    "requiredStatusChecks": ["ci/typecheck", "ci/test", "ci/bundle-size"]
  },

  // Tier 3: production dependency → 永不 automerge
  // （默认行为，无需额外配置）

  // 安全例外：安全补丁无论什么类型都允许快速合并
  {
    "matchUpdateTypes": ["patch", "minor"],
    "isSecurityAlert": true,
    "automerge": true,
    "minimumReleaseAge": null,
    "schedule": null
  }
]
```

`platformAutomerge: true` 使用 GitHub 的原生 auto-merge 功能，比 Renovate 自己轮询合并更可靠。`minimumReleaseAge: 3 days` 避开刚发布的版本——很多包的 bug 在发布后 48 小时内被发现并修复。

production dependencies 不做 automerge 是我们的硬性规则。即使只是 patch，运行时依赖的变化也可能影响用户。这条规则在半年内帮我们挡住了两次上游 regression。

## CI 门禁：自动合并的安全网

Automerge 的前提是 CI 门禁足够严格。我们的门禁有三层：

**第一层：TypeCheck**

```yaml
# .github/workflows/ci.yml
typecheck:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
    - run: pnpm typecheck
```

`--frozen-lockfile` 确保 CI 使用的依赖版本和 PR 中的 lockfile 完全一致。如果 Renovate 更新了 lockfile 但某个包的类型定义变了导致编译失败，这个 step 会拦住。

**第二层：测试**

```yaml
test:
  needs: typecheck
  runs-on: ubuntu-latest
  steps:
    # ... setup same as above
    - run: pnpm test --run --coverage
    - name: Check coverage threshold
      run: |
        COVERAGE=$(cat coverage/summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage dropped below 80%: $COVERAGE%"
          exit 1
        fi
```

覆盖率门槛防止依赖升级悄悄降低了测试有效性。我们遇到过一次 utility 库升级后改变了边界行为，测试全绿但覆盖率掉了 5 个百分点——说明有些分支不再被覆盖了。

**第三层：Bundle Size Budget**

```yaml
bundle-size:
  needs: test
  runs-on: ubuntu-latest
  steps:
    # ... setup
    - run: pnpm build
    - name: Check bundle size
      run: |
        SIZE=$(stat -f%z dist/app.js)
        BUDGET=256000  # 250KB
        if [ "$SIZE" -gt "$BUDGET" ]; then
          echo "Bundle size ${SIZE}B exceeds budget ${BUDGET}B"
          exit 1
        fi
```

Bundle size 门禁对依赖升级特别重要。一个看似无害的 minor 升级可能引入新的子依赖，让打包体积膨胀 20%。我们在 Vue Router 的一次 minor 升级中就遇到了这种情况——新版本引入了一个可选的路由预加载模块，tree-shaking 没生效，包体积增加了 35KB。

## Breaking Change Major 升级：Codemod 集成

Major 升级不能靠 automerge，但可以靠自动化降低人工成本。我们的做法是把已知的 codemod 集成到 Renovate PR 的 post-upgrade 步骤中。

```jsonc
// renovate.json
{
  "postUpgradeTasks": {
    "commands": [
      "pnpm install --no-frozen-lockfile",
      "pnpm exec codemod-runner --changed-packages {{{updatedPackageNames}}}"
    ],
    "fileFilters": ["**/*.ts", "**/*.vue", "**/*.css"],
    "executionTimeout": 300
  }
}
```

`codemod-runner` 是我们写的一个薄包装脚本，根据变更的包名查找并执行对应的 codemod：

```typescript
// scripts/codemod-runner.ts
import { execSync } from 'child_process'

const CODEMOD_MAP: Record<string, string[]> = {
  'vue': ['npx @vue/migrate-v6 --force'],
  'eslint': ['npx @eslint/migrate-config'],
  'vitest': ['npx @vitest/codemod v3-to-v4'],
  '@tanstack/vue-query': ['npx @tanstack/query-codemod v5-to-v6'],
}

const changedPackages = process.argv.slice(2)

for (const pkg of changedPackages) {
  const commands = CODEMOD_MAP[pkg]
  if (!commands) continue

  console.log(`Running codemods for ${pkg}...`)
  for (const cmd of commands) {
    try {
      execSync(cmd, { stdio: 'inherit', timeout: 120_000 })
    } catch (e) {
      console.warn(`Codemod failed for ${pkg}: ${e.message}`)
      // 不退出，让后续人工 review 处理
    }
  }
}
```

Codemod 执行后的文件变更会被 Renovate 追加到同一个 PR 中。Reviewer 看到的是已经迁移过的代码，而不是原始 breaking change + 手动迁移两步。这把我们处理 major 升级的平均时间从 4 小时降到了 1 小时。

## 安全漏洞响应：限时工作流

安全更新和普通更新的流程不同。我们的规则是：

1. **高危（CVSS ≥ 7.0）**：Renovate 立即创建 PR（不受 schedule 限制），CI 通过后自动合并，同时通知值班人员确认
2. **中危（CVSS 4.0-6.9）**：下一个工作日处理，走正常 CI 流程
3. **低危（CVSS < 4.0）**：归入周一下午的常规升级批次

```jsonc
"vulnerabilityAlerts": {
  "enabled": true,
  "labels": ["security"],
  "assignees": ["team/security-reviewer"],
  "schedule": null,
  "minimumReleaseAge": null
}
```

配合 GitHub Advisory Database 的自动检测，Renovate 会在发现漏洞时立刻生成修复 PR。我们对高危漏洞设了一个 Slack webhook 通知：

```typescript
// renovate-webhook-handler.ts (Cloudflare Worker)
export default {
  async fetch(request: Request) {
    const payload = await request.json()

    if (payload.action === 'opened' && payload.pull_request.labels.some(l => l.name === 'security')) {
      const severity = extractSeverity(payload.pull_request.body)

      if (severity === 'high' || severity === 'critical') {
        await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify({
            text: `🚨 High-severity security fix: ${payload.pull_request.title}`,
            blocks: [{
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${payload.pull_request.title}*\nSeverity: ${severity}\n<${payload.pull_request.html_url}|View PR>`,
              },
            }],
          }),
        })
      }
    }

    return new Response('ok')
  },
}
```

## 效果度量：三个月的数据

推行这套方案三个月后，我们从 GitHub Insights 和内部看板中提取了以下数据：

| 指标 | 改造前 | 改造后 | 变化 |
|------|--------|--------|------|
| 月度依赖升级人工耗时 | 24h | 4h | -83% |
| 安全漏洞平均修复时长 | 18 天 | 1.8 天 | -90% |
| 升级导致的线上事故 | 3 次/季度 | 0 次 | -100% |
| 依赖落后最新版本 >30 天的数量 | 47 个 | 6 个 | -87% |
| PR 平均审核时间（依赖类） | 2.3 天 | 0.4 天 | -83% |

"升级导致的线上事故"归零主要归功于 CI 三层门禁。之前三次事故中有两次是类型错误未被发现（当时没有 typecheck 门禁），一次是 bundle 体积暴涨导致移动端超时（当时没有 size budget）。

唯一需要注意的是 automerge 的误合风险。我们有过一次 devDependency 的 minor 升级通过了所有 CI 但引入了 flaky test，两周后才被发现。后来加了 `minimumReleaseAge: 3 days` 和对 flaky test 的检测（连续跑 3 次测试取交集），这个问题没再出现。

## 小结

依赖自动升级不是一个工具问题，是一个流程设计问题。Renovate 的配置决定了 PR 的可管理性，CI 门禁决定了自动合并的安全性，codemod 集成决定了 major 升级的人工成本，安全响应流程决定了漏洞暴露窗口。这四个环节缺一不可。落地建议从小范围开始：先对一个低风险 package 开启 automerge + CI 门禁，跑两周验证稳定性，再逐步扩大到整个 monorepo。不要试图一步到位——信任是积累出来的，不是配置出来的。
