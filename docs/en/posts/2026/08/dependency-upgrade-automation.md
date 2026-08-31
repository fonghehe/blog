---
title: "Automated Dependency Upgrades in a pnpm Monorepo: Renovate Configuration and CI Gates in Practice"
date: 2026-08-23 11:31:54
tags:
  - Engineering
  - Security
readingTime: 7
description: "Implementing automated dependency upgrades in a pnpm monorepo isn't just about installing Renovate. This article covers grouping strategies, tiered automerge, lockfile-only updates, CI gates (typecheck/tests/bundle size), breaking change codemod integration, and security vulnerability response workflows — with real adoption data from our team."
wordCount: 930
---

Last year our team's monorepo had 12 packages, 4 apps, and over 300 total dependencies. The state of manual dependency upgrades was: averaging 3 days per month handling upgrade PRs, security vulnerabilities taking an average of 18 days from disclosure to fix, and occasional production incidents caused by missed breaking changes during upgrades. Early this year we systematically built an automated upgrade pipeline. Three months later, upgrade time dropped to half a day per month, and security vulnerability remediation cycles compressed to under 2 days. This article documents the complete configuration approach and pitfalls we encountered.

## Renovate Base Configuration: Monorepo-Specific Considerations

pnpm monorepo Renovate configuration differs from single-repo setups in several key ways: it needs to recognize workspace protocols, handle internal package version coordination, and avoid generating multiple conflicting PRs for the same dependency.

```jsonc
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":automergePatch"
  ],
  // pnpm monorepo-specific settings
  "packageRules": [
    // Don't manage internal workspace packages via Renovate
    {
      "matchPackagePatterns": ["^@our-scope/"],
      "enabled": false
    }
  ],
  // Lockfile maintenance mode: only update lockfile, don't change package.json version ranges
  "rangeStrategy": "update-lockfile",
  // Limit concurrent PRs to avoid saturating CI
  "prConcurrentLimit": 5,
  // Batch PR creation weekly to reduce daily noise
  "schedule": ["before 9am on Monday"],
  // Timezone
  "timezone": "Asia/Shanghai"
}
```

`rangeStrategy: update-lockfile` is the core strategy we chose. It keeps version ranges in `package.json` unchanged (e.g., `^3.2.0`) and only updates the resolved versions in `pnpm-lock.yaml`. The benefit is avoiding a flood of PRs modifying `package.json`, reducing merge conflicts; the downside is it can't auto-upgrade to new majors — those need separate handling, which I'll cover later.

## Grouping Strategy: The Key to Reducing PR Noise

With 300 dependencies each opening its own PR, you'd face 40+ pending reviews on Monday morning. Grouping rules aim to balance "independently reviewable" against "manageable PR count."

```jsonc
"packageRules": [
  // 1. Framework core: upgrade Vue ecosystem together
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

  // 2. Build toolchain: Vite + plugins + Rollup
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

  // 3. Testing: vitest + testing-library + msw
  {
    "groupName": "testing",
    "matchPackagePatterns": [
      "^vitest$",
      "^@vitest/",
      "^@testing-library/",
      "^msw$"
    ]
  },

  // 4. TypeScript ecosystem
  {
    "groupName": "typescript",
    "matchPackagePatterns": [
      "^typescript$",
      "^@types/",
      "^tsup$",
      "^tsx$"
    ]
  },

  // 5. Lint & format: eslint + prettier + stylelint
  {
    "groupName": "linting",
    "matchPackagePatterns": [
      "^eslint$",
      "^@eslint/",
      "^prettier$",
      "^stylelint"
    ]
  },

  // 6. Remaining patch/minor grouped together
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

Grouping granularity depends on your review capacity. Our experience: group dependencies within the same tech stack (they often need coordinated upgrades), and lump unrelated misc patches together (patches are low-risk and don't need individual review). Major upgrades always get their own PR — never grouped.

## Tiered Automerge: Auto-Merging by Risk Level

Not every update requires human review. We split automerge into three tiers:

```jsonc
"packageRules": [
  // Tier 1: patch + devDependency → merge directly
  {
    "matchUpdateTypes": ["patch"],
    "matchDepTypes": ["devDependencies"],
    "automerge": true,
    "automergeType": "pr",
    "platformAutomerge": true,
    "requiredStatusChecks": ["ci/typecheck", "ci/test"]
  },

  // Tier 2: minor + devDependency → merge after CI passes
  {
    "matchUpdateTypes": ["minor"],
    "matchDepTypes": ["devDependencies"],
    "automerge": true,
    "automergeType": "pr",
    "platformAutomerge": true,
    "minimumReleaseAge": "3 days",
    "requiredStatusChecks": ["ci/typecheck", "ci/test", "ci/bundle-size"]
  },

  // Tier 3: production dependency → never automerge
  // (default behavior, no extra config needed)

  // Security exception: security patches allowed to merge fast regardless of type
  {
    "matchUpdateTypes": ["patch", "minor"],
    "isSecurityAlert": true,
    "automerge": true,
    "minimumReleaseAge": null,
    "schedule": null
  }
]
```

`platformAutomerge: true` uses GitHub's native auto-merge feature, which is more reliable than Renovate polling for merges. `minimumReleaseAge: 3 days` avoids freshly released versions — many packages have bugs discovered and fixed within 48 hours of release.

No automerge for production dependencies is our hard rule. Even a patch to a runtime dependency can affect users. This rule caught two upstream regressions for us over six months.

## CI Gates: The Safety Net for Auto-Merging

Automerge的前提 is sufficiently strict CI gates. Ours have three layers:

**Layer 1: TypeCheck**

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

`--frozen-lockfile` ensures CI uses the exact dependency versions from the PR's lockfile. If Renovate updated the lockfile but a package's type definitions changed causing compilation failure, this step catches it.

**Layer 2: Tests**

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

Coverage thresholds prevent dependency upgrades from silently eroding test effectiveness. We once had a utility library upgrade that changed edge-case behavior — tests stayed green but coverage dropped 5 percentage points, meaning some branches were no longer exercised.

**Layer 3: Bundle Size Budget**

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

Bundle size gates are especially important for dependency upgrades. A seemingly harmless minor upgrade can pull in new sub-dependencies that bloat the bundle by 20%. We hit this with a Vue Router minor upgrade — the new version introduced an optional route prefetch module that tree-shaking didn't eliminate, adding 35KB.

## Breaking Change Major Upgrades: Codemod Integration

Major upgrades can't be automerged, but automation can reduce manual effort. We integrate known codemods into Renovate PR post-upgrade steps.

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

`codemod-runner` is a thin wrapper script we wrote that looks up and executes corresponding codemods based on changed package names:

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
      // Don't exit — let subsequent human review handle it
    }
  }
}
```

File changes from codemod execution are appended to the same PR by Renovate. Reviewers see already-migrated code rather than raw breaking changes plus manual migration as two separate steps. This reduced our average major upgrade handling time from 4 hours to 1 hour.

## Security Vulnerability Response: Time-Bound Workflow

Security updates follow a different flow than regular updates. Our rules:

1. **High severity (CVSS >= 7.0)**: Renovate creates a PR immediately (ignoring schedule), auto-merges after CI passes, and notifies the on-call engineer for confirmation
2. **Medium severity (CVSS 4.0-6.9)**: Handled next business day through normal CI flow
3. **Low severity (CVSS < 4.0)**: Rolled into Monday's regular upgrade batch

```jsonc
"vulnerabilityAlerts": {
  "enabled": true,
  "labels": ["security"],
  "assignees": ["team/security-reviewer"],
  "schedule": null,
  "minimumReleaseAge": null
}
```

Combined with GitHub Advisory Database's automatic detection, Renovate generates fix PRs as soon as vulnerabilities are discovered. We set up a Slack webhook notification for high-severity issues:

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

## Impact Metrics: Three Months of Data

After running this system for three months, we pulled the following data from GitHub Insights and internal dashboards:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Monthly dependency upgrade person-hours | 24h | 4h | -83% |
| Average security vulnerability fix time | 18 days | 1.8 days | -90% |
| Upgrade-caused production incidents | 3/quarter | 0 | -100% |
| Dependencies >30 days behind latest | 47 | 6 | -87% |
| Average PR review time (dependency PRs) | 2.3 days | 0.4 days | -83% |

"Upgrade-caused production incidents" dropping to zero is mainly credited to the three-layer CI gates. Two of the previous three incidents were undetected type errors (no typecheck gate at the time), and one was bundle size bloat causing mobile timeouts (no size budget).

The one caution: automerge carries a risk of incorrect merges. We had one case where a devDependency minor upgrade passed all CI but introduced a flaky test that wasn't caught for two weeks. After adding `minimumReleaseAge: 3 days` and flaky test detection (running tests 3 times and taking the intersection), this hasn't recurred.

## Summary

Automated dependency upgrading isn't a tool problem — it's a process design problem. Renovate configuration determines PR manageability, CI gates determine auto-merge safety, codemod integration determines major upgrade labor cost, and security response workflow determines vulnerability exposure window. All four links are essential. Start small: enable automerge + CI gates on one low-risk package first, validate stability for two weeks, then gradually expand to the entire monorepo. Don't try to do everything at once — trust is accumulated, not configured.
