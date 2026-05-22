---
title: "前端平臺工程：從工具鏈到平臺"
date: 2025-11-22 18:56:33
tags:
  - 前端
readingTime: 3
description: "2025 年，\"前端平臺工程\" 不再是大廠的專利。來聊聊中小團隊如何建設自己的前端平臺。"
wordCount: 165
---

2025 年，"前端平臺工程" 不再是大廠的專利。來聊聊中小團隊如何建設自己的前端平臺。

## 什麼是前端平臺工程

```
傳統前端：每個項目獨立搭建腳手架、獨立配置 CI/CD、獨立管理依賴
平臺工程：統一的開發平臺，開箱即用

目標：
  1. 新項目 5 分鐘創建，不需要從零搭建
  2. 統一的開發體驗（CLI、IDE 配置、代碼規範）
  3. 統一的部署流程
  4. 統一的監控和告警
  5. 跨項目複用（組件、工具、配置）
```

## 核心組件

```
前端平臺架構：

┌─────────────────────────────────────────────┐
│              開發者體驗層                      │
│  CLI 工具 / IDE 插件 / 文檔站 / Dashboard    │
├─────────────────────────────────────────────┤
│              項目腳手架層                      │
│  模板系統 / 最佳實踐 / 自動配置               │
├─────────────────────────────────────────────┤
│              共享能力層                       │
│  組件庫 / 工具庫 / 狀態管理 / API 層          │
├─────────────────────────────────────────────┤
│              基礎設施層                       │
│  CI/CD / 部署 / 監控 / 日誌 / 特性開關       │
└─────────────────────────────────────────────┘
```

## CLI 工具

```ts
// @team/cli — 統一的前端 CLI
import { Command } from "commander";
import inquirer from "inquirer";
import { execSync } from "child_process";

const program = new Command();

program
  .name("frontend")
  .description("前端平臺 CLI")
  .version("1.0.0");

// 創建新項目
program
  .command("create")
  .description("創建新項目")
  .argument("<name>", "項目名稱")
  .option("-t, --template <type>", "模板類型", "app")
  .action(async (name: string, options) => {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "template",
        message: "選擇項目模板",
        choices: [
          { name: "React SPA（管理後臺）", value: "admin" },
          { name: "Next.js App（To C 應用）", value: "nextjs" },
          { name: "Astro 站點（文檔/博客）", value: "astro" },
          { name: "組件庫", value: "library" },
        ],
      },
      {
        type: "checkbox",
        name: "features",
        message: "選擇功能模塊",
        choices: [
          { name: "認證模塊", value: "auth" },
          { name: "國際化", value: "i18n" },
          { name: "主題系統", value: "theme" },
          { name: "數據可視化", value: "charts" },
        ],
      },
    ]);

    console.log(`創建項目 ${name}（${answers.template}）...`);

    // 從模板創建
    execSync(
      `npx degit team-templates/${answers.template} ${name}`,
      { stdio: "inherit" },
    );

    // 安裝依賴
    execSync(`cd ${name} && pnpm install`, { stdio: "inherit" });

    // 配置選定的功能
    for (const feature of answers.features) {
      execSync(`cd ${name} && pnpm frontend add ${feature}`, {
        stdio: "inherit",
      });
    }

    console.log(`項目 ${name} 創建完成！`);
    console.log(`  cd ${name} && pnpm dev`);
  });

// 添加功能模塊
program
  .command("add")
  .description("添加功能模塊")
  .argument("<module>", "模塊名稱")
  .action((module: string) => {
    const modules: Record<string, string> = {
      auth: "@team/auth-module",
      i18n: "@team/i18n-module",
      theme: "@team/theme-module",
      charts: "@team/charts-module",
    };

    if (!modules[module]) {
      console.error(`未知模塊: ${module}`);
      console.log(`可用模塊: ${Object.keys(modules).join(", ")}`);
      return;
    }

    execSync(`pnpm add ${modules[module]}`, { stdio: "inherit" });
    console.log(`模塊 ${module} 已添加`);
  });

program.parse();
```

## Monorepo 架構

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

```
前端平臺 Monorepo 結構：

├── apps/
│   ├── admin/          # 管理後臺
│   ├── portal/         # 門户站點
│   └── docs/           # 文檔站
├── packages/
│   ├── ui/             # 組件庫
│   ├── utils/          # 工具庫
│   ├── api-client/     # API 客户端
│   ├── auth/           # 認證模塊
│   └── config/         # 共享配置
├── tools/
│   ├── cli/            # CLI 工具
│   ├── eslint-config/  # ESLint 配置
│   └── tsconfig/       # TypeScript 配置
├── pnpm-workspace.yaml
└── turbo.json
```

```jsonc
// turbo.json — Turborepo 配置
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "typecheck": {}
  }
}
```

## 共享設定

```ts
// packages/config/eslint-config/index.js
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // 團隊統一規則
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

```ts
// packages/config/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 統一 CI/CD

```yaml
# .github/workflows/ci.yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck test build

      # 受影響的包才跑（Turborepo 自動處理）
      # 不需要手動設定哪些包需要跑

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [admin, portal, docs]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=${{ matrix.app }}
      - name: Deploy
        run: |
          # 根據 app 選擇不同的部署策略
          pnpm deploy:${{ matrix.app }}
```

## 小結

- 前端平臺工程的目標是讓開發者專注業務，不被工具鏈困擾
- Monorepo + Turborepo 是當前最佳實踐
- CLI 工具降低項目創建和配置的心智負擔
- 共享配置（ESLint、TypeScript、Prettier）保證代碼一致性
- CI/CD 要做到開箱即用，新項目不需要額外設定
- 平臺工程是持續投入，不是一次性建設
