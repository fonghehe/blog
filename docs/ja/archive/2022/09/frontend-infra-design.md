---
title: "フロントエンドインフラ設計：チームツールチェーンをゼロから構築する"
date: 2022-09-20 11:47:55
tags:
  - フロントエンド
readingTime: 3
description: "チームのテクニカルリーダーとして、今年最も重要な仕事の1つはフロントエンドインフラストラクチャの構築でした。ビジネスコードを書くことではなく、ビジネスコードを書く人々をより効率的にすることです。この記事では、私たちの設計思想と実装プロセスについて説明します。"
wordCount: 302
---

チームのテクニカルリーダーとして、今年最も重要な仕事の1つはフロントエンドインフラストラクチャを構築することでした。業務コードを書くことではなく、業務コードを書く人々をより効率的にすることです。この記事では私たちの設計思想と実装プロセスについて説明します。

## インフラ全景

```
前端基础设施
├── 代码规范
│   ├── ESLint 共享配置
│   ├── Prettier 配置
│   ├── Stylelint 配置
│   └── Commitlint
├── 构建工具
│   ├── Vite 预设配置
│   ├── Babel 预设
│   └── Webpack 预设（兼容旧项目）
├── 组件库
│   ├── 基础组件
│   ├── 业务组件
│   └── 文档站
├── 工具包
│   ├── 请求封装
│   ├── 路由封装
│   └── 通用工具函数
├── 脚手架
│   ├── 项目创建 CLI
│   └── 代码生成器
└── CI/CD
    ├── GitHub Actions 模板
    └── 部署脚本
```

## ESLint 共有設定

```bash
packages/
└── eslint-config/
    ├── package.json
    ├── index.js          # 基础配置
    ├── react.js          # React 项目配置
    ├── vue.js            # Vue 项目配置
    └── node.js           # Node.js 项目配置
```

```javascript
// packages/eslint-config/index.js
module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@/**', group: 'internal', position: 'after' },
        ],
        'newlines-between': 'always',
      },
    ],
  },
};
```

```javascript
// packages/eslint-config/react.js
module.exports = {
  extends: [
    './index.js',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
};
```

```json
// packages/eslint-config/package.json
{
  "name": "@mono/eslint-config",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^5.30.0",
    "@typescript-eslint/parser": "^5.30.0",
    "eslint-config-prettier": "^8.5.0",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-react": "^7.30.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-jsx-a11y": "^6.6.0"
  },
  "peerDependencies": {
    "eslint": ">=8"
  }
}
```

## Vite プリセット設定

```typescript
// packages/vite-config/index.ts
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

interface PresetOptions {
  port?: number;
  proxy?: Record<string, string>;
  outDir?: string;
}

export function createViteConfig(opts: PresetOptions = {}): UserConfig {
  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve('src') },
    },
    server: {
      port: opts.port || 3000,
      proxy: opts.proxy
        ? Object.fromEntries(
            Object.entries(opts.proxy).map(([key, target]) => [
              key,
              { target, changeOrigin: true },
            ])
          )
        : undefined,
    },
    build: {
      outDir: opts.outDir || 'dist',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-router': ['react-router-dom'],
          },
        },
      },
    },
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
  });
}
```

## スキャフォールディング CLI

```typescript
// packages/create-app/src/index.ts
import { select, input, confirm } from '@inquirer/prompts';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function main() {
  const projectName = await input({
    message: '项目名称:',
    default: 'my-app',
  });

  const framework = await select({
    message: '选择框架:',
    choices: [
      { name: 'React + Vite', value: 'react-vite' },
      { name: 'Vue + Vite', value: 'vue-vite' },
      { name: 'Next.js', value: 'nextjs' },
    ],
  });

  const withTypeScript = await confirm({
    message: '使用 TypeScript?',
    default: true,
  });

  // 从模板创建
  const templateDir = path.join(__dirname, '../templates', framework);
  const targetDir = path.resolve(projectName);

  fs.cpSync(templateDir, targetDir, { recursive: true });

  // 安装依赖
  execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' });

  // 初始化 git
  execSync('git init', { cwd: targetDir });

  console.log(`
  项目创建成功！

    cd ${projectName}
    pnpm dev
  `);
}

main();
```

## CI/CD テンプレート

```yaml
# templates/.github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-test-build:
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

      - name: Lint
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

## インフラ進化戦略

```typescript
// 私たちの原則：

// 1. 設定より規約
// デフォルト値を提供し、ユーザーは上書き可能
function createViteConfig(overrides?: Partial<UserConfig>) {
  return { ...defaults, ...overrides };
}

// 2. 段階的な採用
// すべてのプロジェクトに移行を強制せず、新プロジェクトは新設定を使用
// 既存プロジェクトは次回メジャーバージョンアップ時に移行

// 3. バージョン固定戦略
// インフラパッケージは caret ( ^1.0.0 ) を使用
// lockfile と組み合わせて一貫性を保証
// 定期的に pnpm update -i でアップグレード
```

## まとめ

フロントエンドインフラの核心的な価値は、チームを「車輪の再発明」から解放し、ビジネスに集中できるようにすることです。ESLint設定、Viteプリセット、スキャフォールディングCLI——それぞれは小さなものですが、組み合わせることで顕著な効率向上をもたらします。重要なのは軽量を保ち、過度な設計をしないことです。