---
title: "前端基礎設施設計：從零搭建團隊工具鏈"
date: 2022-09-20 11:47:55
tags:
  - 前端
readingTime: 2
description: "作為團隊技術負責人，今年最重要的工作之一就是搭建前端基礎設施。不是寫業務程式碼，而是讓寫業務程式碼的人更高效。這篇文章講講我們的設計思路和落地過程。"
---

作為團隊技術負責人，今年最重要的工作之一就是搭建前端基礎設施。不是寫業務程式碼，而是讓寫業務程式碼的人更高效。這篇文章講講我們的設計思路和落地過程。

## 基礎設施全景

```
前端基礎設施
├── 程式碼規範
│   ├── ESLint 共享配置
│   ├── Prettier 配置
│   ├── Stylelint 配置
│   └── Commitlint
├── 構建工具
│   ├── Vite 預設配置
│   ├── Babel 預設
│   └── Webpack 預設（相容舊專案）
├── 元件庫
│   ├── 基礎元件
│   ├── 業務元件
│   └── 文件站
├── 工具包
│   ├── 請求封裝
│   ├── 路由封裝
│   └── 通用工具函式
├── 腳手架
│   ├── 專案建立 CLI
│   └── 程式碼生成器
└── CI/CD
    ├── GitHub Actions 模板
    └── 部署指令碼
```

## ESLint 共享配置

```bash
packages/
└── eslint-config/
    ├── package.json
    ├── index.js          # 基礎配置
    ├── react.js          # React 專案配置
    ├── vue.js            # Vue 專案配置
    └── node.js           # Node.js 專案配置
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

## Vite 預設配置

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

## 腳手架 CLI

```typescript
// packages/create-app/src/index.ts
import { select, input, confirm } from '@inquirer/prompts';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function main() {
  const projectName = await input({
    message: '專案名稱:',
    default: 'my-app',
  });

  const framework = await select({
    message: '選擇框架:',
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

  // 從模板建立
  const templateDir = path.join(__dirname, '../templates', framework);
  const targetDir = path.resolve(projectName);

  fs.cpSync(templateDir, targetDir, { recursive: true });

  // 安裝依賴
  execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' });

  // 初始化 git
  execSync('git init', { cwd: targetDir });

  console.log(`
  專案建立成功！

    cd ${projectName}
    pnpm dev
  `);
}

main();
```

## CI/CD 模板

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

## 基礎設施的演進策略

```typescript
// 我們的原則：

// 1. 約定優於配置
// 提供預設值，使用者可以覆蓋
function createViteConfig(overrides?: Partial<UserConfig>) {
  return { ...defaults, ...overrides };
}

// 2. 漸進式採用
// 不強制所有專案遷移，新專案用新配置
// 老專案在下次大版本升級時遷移

// 3. 版本鎖定策略
// 基礎設施包用 caret ( ^1.0.0 )
// 配合 lockfile 保證一致性
// 定期用 pnpm update -i 升級
```

## 小結

前端基礎設施的核心價值是：讓團隊從「重複造輪子」中解放出來，把精力放在業務上。ESLint 配置、Vite 預設、腳手架 CLI——每個都不大，但組合起來就是顯著的效率提升。關鍵是保持輕量，不要過度設計。