---
title: "フロントエンドプラットフォームエンジニアリング：ツールチェーンからプラットフォームへ"
date: 2025-11-22 10:00:00
tags:
  - フロントエンド
readingTime: 3
description: "2025 年，\"前端平台工程\" 不再是大厂的专利。来聊聊中小团队如何建设自己的前端平台。"
---

2025 年，"前端平台工程" 不再是大厂的专利。来聊聊中小团队如何建设自己的前端平台。

## 什么是前端平台工程

```
传统前端：每个项目独立搭建脚手架、独立配置 CI/CD、独立管理依赖
平台工程：统一的开发平台，开箱即用

目标：
  1. 新项目 5 分钟创建，不需要从零搭建
  2. 统一的开发体验（CLI、IDE 配置、代码规范）
  3. 统一的部署流程
  4. 统一的监控和告警
  5. 跨项目复用（组件、工具、配置）
```

## 核心组件

```
前端平台架构：

┌─────────────────────────────────────────────┐
│              开发者体验层                      │
│  CLI 工具 / IDE 插件 / 文档站 / Dashboard    │
├─────────────────────────────────────────────┤
│              项目脚手架层                      │
│  模板系统 / 最佳实践 / 自动配置               │
├─────────────────────────────────────────────┤
│              共享能力层                       │
│  组件库 / 工具库 / 状态管理 / API 层          │
├─────────────────────────────────────────────┤
│              基础设施层                       │
│  CI/CD / 部署 / 监控 / 日志 / 特性开关       │
└─────────────────────────────────────────────┘
```

## CLI 工具

```ts
// @team/cli — 统一的前端 CLI
import { Command } from "commander";
import inquirer from "inquirer";
import { execSync } from "child_process";

const program = new Command();

program
  .name("frontend")
  .description("前端平台 CLI")
  .version("1.0.0");

// 创建新项目
program
  .command("create")
  .description("创建新项目")
  .argument("<name>", "项目名称")
  .option("-t, --template <type>", "模板类型", "app")
  .action(async (name: string, options) => {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "template",
        message: "选择项目模板",
        choices: [
          { name: "React SPA（管理后台）", value: "admin" },
          { name: "Next.js App（To C 应用）", value: "nextjs" },
          { name: "Astro 站点（文档/博客）", value: "astro" },
          { name: "组件库", value: "library" },
        ],
      },
      {
        type: "checkbox",
        name: "features",
        message: "选择功能模块",
        choices: [
          { name: "认证模块", value: "auth" },
          { name: "国际化", value: "i18n" },
          { name: "主题系统", value: "theme" },
          { name: "数据可视化", value: "charts" },
        ],
      },
    ]);

    console.log(`创建项目 ${name}（${answers.template}）...`);

    // 从模板创建
    execSync(
      `npx degit team-templates/${answers.template} ${name}`,
      { stdio: "inherit" },
    );

    // 安装依赖
    execSync(`cd ${name} && pnpm install`, { stdio: "inherit" });

    // 配置选定的功能
    for (const feature of answers.features) {
      execSync(`cd ${name} && pnpm frontend add ${feature}`, {
        stdio: "inherit",
      });
    }

    console.log(`项目 ${name} 创建完成！`);
    console.log(`  cd ${name} && pnpm dev`);
  });

// 添加功能模块
program
  .command("add")
  .description("添加功能模块")
  .argument("<module>", "模块名称")
  .action((module: string) => {
    const modules: Record<string, string> = {
      auth: "@team/auth-module",
      i18n: "@team/i18n-module",
      theme: "@team/theme-module",
      charts: "@team/charts-module",
    };

    if (!modules[module]) {
      console.error(`未知模块: ${module}`);
      console.log(`可用模块: ${Object.keys(modules).join(", ")}`);
      return;
    }

    execSync(`pnpm add ${modules[module]}`, { stdio: "inherit" });
    console.log(`模块 ${module} 已添加`);
  });

program.parse();
```

## Monorepo 架构

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

```
前端平台 Monorepo 结构：

├── apps/
│   ├── admin/          # 管理后台
│   ├── portal/         # 门户站点
│   └── docs/           # 文档站
├── packages/
│   ├── ui/             # 组件库
│   ├── utils/          # 工具库
│   ├── api-client/     # API 客户端
│   ├── auth/           # 认证模块
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

## 共享配置

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
      // 团队统一规则
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

## 统一 CI/CD

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

      # 受影响的包才跑（Turborepo 自动处理）
      # 不需要手动配置哪些包需要跑

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
          # 根据 app 选择不同的部署策略
          pnpm deploy:${{ matrix.app }}
```

## まとめ

- 前端平台工程的目标是让开发者专注业务，不被工具链困扰
- Monorepo + Turborepo 是当前最佳实践
- CLI 工具降低项目创建和配置的心智负担
- 共享配置（ESLint、TypeScript、Prettier）保证代码一致性
- CI/CD 要做到开箱即用，新项目不需要额外配置
- 平台工程是持续投入，不是一次性建设
