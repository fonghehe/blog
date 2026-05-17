---
title: "フロントエンドインフラ設計：チームツールチェーンをゼロから構築する"
date: 2022-09-20 11:47:55
tags:
  - フロントエンド
readingTime: 2
description: "作为团队技术负责人，今年最重要的工作之一就是搭建前端基础设施。不是写业务代码，而是让写业务代码的人更高效。这篇文章讲讲我们的设计思路和落地过程。"
---

作为团队技术负责人，今年最重要的工作之一就是搭建前端基础设施。不是写业务代码，而是让写业务代码的人更高效。这篇文章讲讲我们的设计思路和落地过程。

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
// 我们的原则：

// 1. 约定优于配置
// 提供默认值，用户可以覆盖
function createViteConfig(overrides?: Partial<UserConfig>) {
  return { ...defaults, ...overrides };
}

// 2. 渐进式采用
// 不强制所有项目迁移，新项目用新配置
// 老项目在下次大版本升级时迁移

// 3. 版本锁定策略
// 基础设施包用 caret ( ^1.0.0 )
// 配合 lockfile 保证一致性
// 定期用 pnpm update -i 升级
```

## まとめ

前端基础设施的核心价值是：让团队从「重复造轮子」中解放出来，把精力放在业务上。ESLint 配置、Vite 预设、脚手架 CLI——每个都不大，但组合起来就是显著的效率提升。关键是保持轻量，不要过度设计。