---
title: "pnpm Monorepo 依存関係自動アップグレード：Renovate 設定と CI ゲート実践"
date: 2026-08-23 11:31:54
tags:
  - エンジニアリング
  - セキュリティ
readingTime: 11
description: "pnpm monorepo で依存関係の自動アップグレードを導入するには、Renovate を入れるだけでは不十分だ。本記事ではグループ化戦略、automerge の段階分け、lockfile-only 更新、CI ゲート（typecheck/テスト/bundle size）、breaking change codemod 統合、セキュリティ脆弱性対応フローを網羅し、チームでの実際の推進データも付す。"
wordCount: 2453
---

昨年、我々のチームの monorepo には 12 個の packages と 4 個の apps があり、依存関係の総数は 300 を超えていた。手動アップグレードの状況はこうだ：平均して毎月 3 日をアップグレード PR の処理に費やし、セキュリティ脆弱性の公開から修正まで平均 18 日、さらにアップグレード時の breaking change の見落としによる本番障害が時折発生していた。今年初めに体系的な自動アップグレードパイプラインを構築し、3 ヶ月後にはアップグレード所要時間が月半日に減少し、セキュリティ脆弱性の修正サイクルは 2 日以内に圧縮された。本記事では設定の全体像と踏んだ落とし穴を記録する。

## Renovate 基本設定：monorepo 特有の考慮事項

pnpm monorepo の Renovate 設定はモノレポといくつかの重要な違いがある：workspace プロトコルの識別、内部パッケージのバージョン連動の処理、同一依存関係に対する複数競合 PR の回避が必要だ。

```jsonc
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":automergePatch"
  ],
  // pnpm monorepo 専用設定
  "packageRules": [
    // 内部 workspace パッケージは Renovate で管理しない
    {
      "matchPackagePatterns": ["^@our-scope/"],
      "enabled": false
    }
  ],
  // lockfile メンテナンスモード：lockfile のみ更新し、package.json のバージョン範囲は変更しない
  "rangeStrategy": "update-lockfile",
  // 同時実行 PR 数を制限し、CI が飽和するのを防ぐ
  "prConcurrentLimit": 5,
  // 毎週集中的に PR を作成し、日常の妨害を減らす
  "schedule": ["before 9am on Monday"],
  // タイムゾーン
  "timezone": "Asia/Shanghai"
}
```

`rangeStrategy: update-lockfile` は我々が選択したコア戦略だ。`package.json` のバージョン範囲（例：`^3.2.0`）はそのまま保持し、`pnpm-lock.yaml` で解決される具体的なバージョンのみを更新する。利点は `package.json` を変更する PR が大量に発生せず、マージコンフリクトが減ること。欠点は新 major への自動アップグレードができないこと――major は別途処理する必要があり、後述する。

## グループ化戦略：PR ノイズ低減の鍵

300 の依存関係それぞれが個別に PR を開いたら、月曜の朝に 40 以上のレビュー待ち PR が並ぶことになる。グルーピング規則の設計目標は「独立してレビュー可能」と「PR 数が制御可能」のバランスを取ることだ。

```jsonc
"packageRules": [
  // 1. フレームワークコア：Vue ファミリーはまとめてアップグレード
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

  // 2. ビルドツールチェーン：Vite + プラグイン + Rollup
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

  // 3. テスト関連：vitest + testing-library + msw
  {
    "groupName": "testing",
    "matchPackagePatterns": [
      "^vitest$",
      "^@vitest/",
      "^@testing-library/",
      "^msw$"
    ]
  },

  // 4. TypeScript エコシステム
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

  // 6. その他の patch/minor は一まとめ
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

グループ化の粒度はレビュー能力に依存する。我々の経験則は：同一技術スタックの依存関係は同じグループに入れる（配套アップグレードが必要なことが多いため）、無関係な雑多な patch は一つにまとめる（patch はリスクが低く、個別レビューは不要なため）。Major アップグレードは常に個別 PR とし、決してグループに入れない。

## Automerge の段階分け：リスクに応じた自動マージ

すべての更新が人的レビューを必要とするわけではない。我々は automerge を 3 段階に分けている：

```jsonc
"packageRules": [
  // Tier 1: patch + devDependency → 直接マージ
  {
    "matchUpdateTypes": ["patch"],
    "matchDepTypes": ["devDependencies"],
    "automerge": true,
    "automergeType": "pr",
    "platformAutomerge": true,
    "requiredStatusChecks": ["ci/typecheck", "ci/test"]
  },

  // Tier 2: minor + devDependency → CI 通過後にマージ
  {
    "matchUpdateTypes": ["minor"],
    "matchDepTypes": ["devDependencies"],
    "automerge": true,
    "automergeType": "pr",
    "platformAutomerge": true,
    "minimumReleaseAge": "3 days",
    "requiredStatusChecks": ["ci/typecheck", "ci/test", "ci/bundle-size"]
  },

  // Tier 3: production dependency → 絶対に automerge しない
  // （デフォルト動作なので追加設定不要）

  // セキュリティ例外：セキュリティパッチはタイプに関係なく高速マージを許可
  {
    "matchUpdateTypes": ["patch", "minor"],
    "isSecurityAlert": true,
    "automerge": true,
    "minimumReleaseAge": null,
    "schedule": null
  }
]
```

`platformAutomerge: true` は GitHub のネイティブ auto-merge 機能を使用し、Renovate 自身がポーリングしてマージするより信頼性が高い。`minimumReleaseAge: 3 days` はリリース直後のバージョンを避ける――多くのパッケージのバグはリリース後 48 時間以内に発見・修正される。

production dependencies を automerge しないのは我々のハードルールだ。たとえ patch でも、ランタイム依存の変更はユーザーに影響を与える可能性がある。このルールは半年間に 2 回の上流 regression を防いでくれた。

## CI ゲート：自動マージのセーフティネット

Automerge の前提は CI ゲートが十分に厳格であることだ。我々のゲートは 3 層で構成される：

**第 1 層：TypeCheck**

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

`--frozen-lockfile` は CI が使用する依存関係のバージョンが PR の lockfile と完全に一致することを保証する。Renovate が lockfile を更新したが、あるパッケージの型定義変更でコンパイルが失敗した場合、このステップが阻止する。

**第 2 層：テスト**

```yaml
test:
  needs: typecheck
  runs-on: ubuntu-latest
  steps:
    # ... 上記と同じセットアップ
    - run: pnpm test --run --coverage
    - name: Check coverage threshold
      run: |
        COVERAGE=$(cat coverage/summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage dropped below 80%: $COVERAGE%"
          exit 1
        fi
```

カバレッジ閾値は、依存関係のアップグレードがテストの有効性を密かに低下させることを防ぐ。我々は utility ライブラリのアップグレード後に境界挙動が変更され、テストは全グリーンだがカバレッジが 5 ポイント低下したケースを経験した――いくつかのブランチがカバーされなくなったことを示している。

**第 3 層：Bundle Size Budget**

```yaml
bundle-size:
  needs: test
  runs-on: ubuntu-latest
  steps:
    # ... セットアップ
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

Bundle size ゲートは依存関係のアップグレードに特に重要だ。一見無害な minor アップグレードが新しいサブ依存関係を持ち込み、バンドルサイズを 20% 膨らませることがある。我々は Vue Router の minor アップグレードでまさにこの状況に遭遇した――新バージョンがオプションのルートプリロードモジュールを導入したが、tree-shaking が機能せず、バンドルサイズが 35KB 増加した。

## Breaking Change Major アップグレード：Codemod 統合

Major アップグレードは automerge に頼れないが、自動化で人的コストを下げることができる。我々のアプローチは、既知の codemod を Renovate PR の post-upgrade ステップに統合することだ。

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

`codemod-runner` は我々が書いた薄いラッパスクリプトで、変更されたパッケージ名に基づいて対応する codemod を検索・実行する：

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
      // 終了せず、後続の手動 review に委ねる
    }
  }
}
```

Codemod 実行後のファイル変更は Renovate が同一 PR に追加する。Reviewer が見るのは移行済みのコードであり、元の breaking change + 手動移行の 2 ステップではない。これにより major アップグレード処理の平均時間が 4 時間から 1 時間に短縮された。

## セキュリティ脆弱性対応：時間制限ワークフロー

セキュリティ更新は通常更新とフローが異なる。我々のルールは以下の通り：

1. **高危険度（CVSS ≥ 7.0）**：Renovate が即座に PR を作成（schedule 制限なし）、CI 通過後に自動マージし、同時に当直担当者に通知して確認を求める
2. **中危険度（CVSS 4.0-6.9）**：次の営業日に処理、通常の CI フローに従う
3. **低危険度（CVSS < 4.0）**：月曜午後の定期アップグレードバッチに組み込む

```jsonc
"vulnerabilityAlerts": {
  "enabled": true,
  "labels": ["security"],
  "assignees": ["team/security-reviewer"],
  "schedule": null,
  "minimumReleaseAge": null
}
```

GitHub Advisory Database の自動検出と連携し、Renovate は脆弱性発見時に即座に修正 PR を生成する。高危険度脆弱性に対しては Slack webhook 通知を設定している：

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

## 効果測定：3 ヶ月のデータ

この方案を 3 ヶ月運用した後、GitHub Insights と内部ダッシュボードから以下のデータを抽出した：

| 指標 | 改修前 | 改修後 | 変化 |
|------|--------|--------|------|
| 月間依存関係アップグレード人工時 | 24h | 4h | -83% |
| セキュリティ脆弱性平均修正期間 | 18 日 | 1.8 日 | -90% |
| アップグレード起因の本番障害 | 3 回/四半期 | 0 回 | -100% |
| 最新バージョンより 30 日以上遅れている依存関係数 | 47 個 | 6 個 | -87% |
| PR 平均レビュー時間（依存関係系） | 2.3 日 | 0.4 日 | -83% |

「アップグレード起因の本番障害」がゼロになったのは主に CI 3 層ゲートの功績だ。以前の 3 回の障害のうち 2 回は型エラーの未検出（当時 typecheck ゲートがなかった）、1 回はバンドルサイズの急増によるモバイルタイムアウト（当時 size budget がなかった）だった。

唯一注意すべきは automerge の誤マージリスクだ。devDependency の minor アップグレードが全 CI を通過しつつ flaky test を持ち込み、2 週間後に発見されたケースがあった。その後 `minimumReleaseAge: 3 days` の追加と flaky test の検出（テストを 3 回連続実行して共通部分を取る）を行い、この問題は再発していない。

## まとめ

依存関係の自動アップグレードはツールの問題ではなく、プロセス設計の問題だ。Renovate の設定が PR の管理可能性を決め、CI ゲートが自動マージの安全性を決め、codemod 統合が major アップグレードの人的コストを決め、セキュリティ対応フローが脆弱性暴露ウィンドウを決める。この 4 つの环节は缺一不可だ。導入は小範囲から始めることを推奨する：まず低リスクの package 1 つに automerge + CI ゲートを有効にし、2 週間運用して安定性を検証してから、monorepo 全体に拡大する。一気に完璧を目指してはいけない――信頼は積み上げるものであり、設定するものではない。
