---
title: "Monorepo 2026: Turborepo and pnpm workspace Large-scale Project Governance"
date: 2026-06-27 17:36:18
tags:
  - Engineering
readingTime: 2
description: "Monorepo has become the standard architecture for large frontend projects. This article explores Turborepo and pnpm workspace application in large-scale projects, including build optimization, dependency management, and team collaboration."
wordCount: 199
---

As frontend project scale grows, Monorepo architecture has evolved from an "optional solution" to an "inevitable choice." In 2026, the Turborepo and pnpm workspace combination has become the mainstream solution for managing large frontend projects. Understanding their principles and best practices is key to building maintainable frontend architecture.

## Monorepo Core Value

Monorepo's core value isn't "all code in one repository," but:

1. **Atomic changes**: Cross-package modifications can be a single atomic commit
2. **Dependency consistency**: All packages share the same dependency versions
3. **Code reuse**: Shared code doesn't need to be published to npm
4. **Unified toolchain**: All packages use the same build, test, and lint configurations

```bash
# Typical Monorepo structure
frontend-monorepo/
├── apps/
│   ├── web/           # Main application
│   ├── admin/         # Admin dashboard
│   └── mobile/        # Mobile app
├── packages/
│   ├── ui/            # UI component library
│   ├── utils/         # Utility functions
│   ├── config/        # Shared configurations
│   └── types/         # TypeScript type definitions
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## pnpm workspace Configuration

### Basic Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// Root package.json
{
  "name": "frontend-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

### Inter-package Dependencies

```json
// apps/web/package.json
{
  "name": "@myorg/web",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:*",
    "@myorg/types": "workspace:*"
  }
}
```

## Turborepo Build Optimization

### Basic Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Advanced Configuration

```json
// turbo.json (advanced configuration)
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "env": ["NODE_ENV", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": ["NODE_ENV"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", ".eslintrc.*", "eslint.config.*"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "vitest.config.*"],
      "env": ["NODE_ENV"]
    }
  }
}
```

## Shared Configuration Management

### ESLint Configuration

```json
// packages/config/eslint/package.json
{
  "name": "@myorg/eslint-config",
  "version": "0.0.0",
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-plugin-react": "^7.34.0"
  }
}
```

```javascript
// packages/config/eslint/index.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended'
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  }
}
```

## Development Workflow

### Local Development

```bash
# Start all applications
pnpm dev

# Start specific application
pnpm --filter @myorg/web dev

# Start specific package and its dependencies
pnpm --filter @myorg/web... dev
```

### Build and Test

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @myorg/web build

# Run tests
pnpm test

# Run specific package's tests
pnpm --filter @myorg/utils test
```

## Large-scale Project Optimization

### Build Cache Optimization

```json
// turbo.json (optimized configuration)
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "inputs": [
        "src/**",
        "package.json",
        "tsconfig.json",
        "!src/**/*.test.*",
        "!src/**/*.spec.*"
      ]
    }
  }
}
```

### Parallel Execution

```bash
# Turborepo automatically executes independent tasks in parallel
turbo run build --concurrency=4

# View parallel execution status
turbo run build --dry --verbosity=2
```

## Team Collaboration Patterns

### Package Ownership

```json
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "owners": ["team-frontend"],
  "files": ["dist"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Lint
        run: pnpm lint
      
      - name: Test
        run: pnpm test
```

## Summary

Monorepo architecture through Turborepo and pnpm workspace combination provides efficient development and build experience for large frontend projects. The key is: reasonable package division, shared configuration management, dependency version locking, and fully utilizing caching mechanisms. As project scale grows, these practices can significantly improve team development efficiency and code quality.
