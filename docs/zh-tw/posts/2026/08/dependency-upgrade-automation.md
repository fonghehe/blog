---
title: "pnpm Monorepo 依賴自動升級：Renovate 設定與 CI 門禁實戰"
date: 2026-08-23 11:31:54
tags:
  - 工程化
  - 安全
readingTime: 9
description: "在 pnpm monorepo 中落地依賴自動升級，不是裝個 Renovate 就完事。本文覆蓋分組策略、automerge 分級、lockfile-only 更新、CI 門禁（typecheck/測試/bundle size）、breaking change codemod 整合和安全漏洞回應流程，附團隊實際推行資料。"
wordCount: 3600
---

去年我們團隊的 monorepo 有 12 個 packages、4 個 apps，依賴總數超過 300 個。手動升級依賴的狀態是：平均每月花 3 天處理升級 PR，安全漏洞從發布到修復平均 18 天，還時不時因為升級漏改 breaking change 導致線上事故。今年初我們系統性地搭了一套自動升級流水線，三個月後升級耗時降到每月半天，安全漏洞修復週期壓到 2 天以內。這篇文章記錄完整的設定思路和踩過的坑。

## Renovate 基礎設定：monorepo 的特殊考量

pnpm monorepo 的 Renovate 設定和單儲存庫有幾個關鍵區別：需要識別 workspace 協定、處理內部套件版本連動、避免對同一依賴產生多個衝突 PR。

```jsonc
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":automergePatch"
  ],
  // pnpm monorepo 專屬設定
  "packageRules": [
    // 內部 workspace 套件不透過 Renovate 管理
    {
      "matchPackagePatterns": ["^@our-scope/"],
      "enabled": false
    }
  ],
  // lockfile 維護模式：只更新 lockfile，不改 package.json 的版本範圍
  "rangeStrategy": "update-lockfile",
  // 限制併發 PR 數量，避免 CI 被打滿
  "prConcurrentLimit": 5,
  // 每週集中建立 PR，減少日常干擾
  "schedule": ["before 9am on Monday"],
  // 時區
  "timezone": "Asia/Shanghai"
}
```

`rangeStrategy: update-lockfile` 是我們選的核心策略。它保持 `package.json` 中的版本範圍不變（如 `^3.2.0`），只更新 `pnpm-lock.yaml` 中解析到的具體版本。好處是不會產生大量修改 `package.json` 的 PR，減少了合併衝突；壞處是無法自動升級到新 major——major 需要單獨處理，後面會講。

## 分組策略：減少 PR 噪音的關鍵

300 個依賴如果每個都單獨開 PR，週一早上你會看到 40+ 個待審 PR。分組規則的設計目標是在「獨立可審查」和「PR 數量可控」之間找平衡。

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

  // 2. 建構工具鏈：Vite + 外掛 + Rollup
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

  // 3. 測試相關：vitest + testing-library + msw
  {
    "groupName": "testing",
    "matchPackagePatterns": [
      "^vitest$",
      "^@vitest/",
      "^@testing-library/",
      "^msw$"
    ]
  },

  // 4. TypeScript 生態
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

  // 6. 其餘 patch/minor 歸為一組
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

分組的粒度取決於你的 review 能力。我們的經驗是：同一技術棧的依賴放一組（因為它們經常需要配套升級），不相關的雜項 patch 放一組（因為 patch 風險低，不需要逐個審查）。Major 升級永遠單獨出 PR，絕不進組。

## Automerge 分級：按風險分層自動合併

不是所有更新都需要人工 review。我們把 automerge 分成三級：

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

  // Tier 2: minor + devDependency → CI 通過後合
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
  // （預設行為，無需額外設定）

  // 安全例外：安全修補無論什麼類型都允許快速合併
  {
    "matchUpdateTypes": ["patch", "minor"],
    "isSecurityAlert": true,
    "automerge": true,
    "minimumReleaseAge": null,
    "schedule": null
  }
]
```

`platformAutomerge: true` 使用 GitHub 的原生 auto-merge 功能，比 Renovate 自己輪詢合併更可靠。`minimumReleaseAge: 3 days` 避開剛發布的版本——很多套件的 bug 在發布後 48 小時內被發現並修復。

production dependencies 不做 automerge 是我們的硬性規則。即使只是 patch，執行時依賴的變化也可能影響使用者。這條規則在半年內幫我們擋住了兩次上游 regression。

## CI 門禁：自動合併的安全網

Automerge 的前提是 CI 門禁足夠嚴格。我們的門禁有三層：

**第一層：TypeCheck**

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

`--frozen-lockfile` 確保 CI 使用的依賴版本和 PR 中的 lockfile 完全一致。如果 Renovate 更新了 lockfile 但某個套件的型別定義變了導致編譯失敗，這個 step 會攔住。

**第二層：測試**

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

覆蓋率門檻防止依賴升級悄悄降低了測試有效性。我們遇到過一次 utility 函式庫升級後改變了邊界行為，測試全綠但覆蓋率掉了 5 個百分點——說明有些分支不再被覆蓋了。

**第三層：Bundle Size Budget**

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

Bundle size 門禁對依賴升級特別重要。一個看似無害的 minor 升級可能引入新的子依賴，讓打包體積膨脹 20%。我們在 Vue Router 的一次 minor 升級中就遇到了這種情況——新版本引入了一個可選的路由預載入模組，tree-shaking 沒生效，套件體積增加了 35KB。

## Breaking Change Major 升級：Codemod 整合

Major 升級不能靠 automerge，但可以靠自動化降低人工成本。我們的做法是把已知的 codemod 整合到 Renovate PR 的 post-upgrade 步驟中。

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

`codemod-runner` 是我們寫的一個薄包裝指令碼，根據變更的套件名稱尋找並執行對應的 codemod：

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
      // 不退出，讓後續人工 review 處理
    }
  }
}
```

Codemod 執行後的檔案變更會被 Renovate 追加到同一個 PR 中。Reviewer 看到的是已經遷移過的程式碼，而不是原始 breaking change + 手動遷移兩步。這把我們處理 major 升級的平均時間從 4 小時降到了 1 小時。

## 安全漏洞回應：限時工作流程

安全更新和普通更新的流程不同。我們的規則是：

1. **高危（CVSS ≥ 7.0）**：Renovate 立即建立 PR（不受 schedule 限制），CI 通過後自動合併，同時通知值班人員確認
2. **中危（CVSS 4.0-6.9）**：下一個工作日處理，走正常 CI 流程
3. **低危（CVSS < 4.0）**：歸入週一下午的常規升級批次

```jsonc
"vulnerabilityAlerts": {
  "enabled": true,
  "labels": ["security"],
  "assignees": ["team/security-reviewer"],
  "schedule": null,
  "minimumReleaseAge": null
}
```

配合 GitHub Advisory Database 的自動偵測，Renovate 會在發現漏洞時立刻產生修復 PR。我們對高危漏洞設了一個 Slack webhook 通知：

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

## 效果度量：三個月的資料

推行這套方案三個月後，我們從 GitHub Insights 和內部看板中提取了以下資料：

| 指標 | 改造前 | 改造後 | 變化 |
|------|--------|--------|------|
| 月度依賴升級人工耗時 | 24h | 4h | -83% |
| 安全漏洞平均修復時長 | 18 天 | 1.8 天 | -90% |
| 升級導致的線上事故 | 3 次/季 | 0 次 | -100% |
| 依賴落後最新版本 >30 天的數量 | 47 個 | 6 個 | -87% |
| PR 平均審核時間（依賴類） | 2.3 天 | 0.4 天 | -83% |

「升級導致的線上事故」歸零主要歸功於 CI 三層門禁。之前三次事故中有兩次是型別錯誤未被發現（當時沒有 typecheck 門禁），一次是 bundle 體積暴漲導致行動端逾時（當時沒有 size budget）。

唯一需要注意的是 automerge 的誤合風險。我們有過一次 devDependency 的 minor 升級通過了所有 CI 但引入了 flaky test，兩週後才被發現。後來加了 `minimumReleaseAge: 3 days` 和對 flaky test 的偵測（連續跑 3 次測試取交集），這個問題沒再出現。

## 小結

依賴自動升級不是一個工具問題，是一個流程設計問題。Renovate 的設定決定了 PR 的可管理性，CI 門禁決定了自動合併的安全性，codemod 整合決定了 major 升級的人工成本，安全回應流程決定了漏洞暴露窗口。這四個環節缺一不可。落地建議從小範圍開始：先對一個低風險 package 開啟 automerge + CI 門禁，跑兩週驗證穩定性，再逐步擴大到整個 monorepo。不要試圖一步到位——信任是累積出來的，不是設定出來的。
