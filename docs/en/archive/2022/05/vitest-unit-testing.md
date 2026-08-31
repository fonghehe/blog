---
title: "Vitest: The Vite-Native Test Framework — Jest Killer?"
date: 2022-05-24 14:31:37
tags:
  - Vite
  - Vitest
readingTime: 3
description: "If your project uses Vite, Vitest is the optimal testing solution. It shares configuration with Vite, uses the same transform pipeline, and has native ESM support — things that require all kinds of hacks in Jest work out of the box with Vitest."
wordCount: 251
---

If your project uses Vite, Vitest is the optimal testing solution. It shares configuration with Vite, uses the same transform pipeline, and has native ESM support — things that require all kinds of hacks in Jest work out of the box with Vitest.

## Quick Start

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Jest API Compatibility

```typescript
// sum.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sum, asyncSum } from './sum';

describe('sum', () => {
  it('两数相加', () => {
    expect(sum(1, 2)).toBe(3);
  });

  it('异步计算', async () => {
    const result = await asyncSum(1, 2);
    expect(result).toBe(3);
  });
});

// Mock 函数
describe('with mocks', () => {
  it('spy 函数调用', () => {
    const fn = vi.fn();
    fn('hello');
    expect(fn).toHaveBeenCalledWith('hello');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Mock 模块', () => {
    vi.mock('./api', () => ({
      fetchData: vi.fn().mockResolvedValue({ id: 1 }),
    }));
  });

  it('Mock 定时器', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    setTimeout(callback, 1000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

Most Jest APIs work directly, so the migration cost is low.

## Sharing Configuration with Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
});

// vitest.config.ts
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig({
  ...viteConfig,
  test: {
    environment: 'jsdom',
    globals: true,
    // 测试专用配置
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Path aliases, plugins, environment variables — all inherited automatically, no need to configure `moduleNameMapper` separately like in Jest.

## React Component Testing

```tsx
// Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('渲染文本', () => {
    render(<Button>点击我</Button>);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });

  it('点击回调', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>点击</Button>);
    fireEvent.click(screen.getByText('点击'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('禁用状态', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>禁用</Button>);
    fireEvent.click(screen.getByText('禁用'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

## Snapshot Testing

```typescript
// config.test.ts
import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from './config';

describe('config', () => {
  it('默认配置快照', () => {
    const config = getDefaultConfig();
    expect(config).toMatchInlineSnapshot(`
      {
        "debug": false,
        "port": 3000,
        "theme": "light",
      }
    `);
  });
});
```

Inline snapshots are embedded directly in the test file, which is more intuitive than separate `.snap` files.

## Test UI

```bash
vitest --ui
```

Vitest ships with a built-in Web UI for viewing test results, coverage, and timing. It's more user-friendly than Jest's output.

## Mock Strategies

```typescript
// Mock 第三方模块
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { users: [] } }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

// Mock 一部分模块
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils');
  return {
    ...actual,
    formatDate: vi.fn().mockReturnValue('2022-01-01'),
  };
});

// Mock CSS 模块
vi.mock('*.module.css', () => ({
  default: { container: 'mock-container' },
}));

// Mock 图片
vi.mock('*.svg', () => ({
  default: 'mock-svg-url',
}));
```

## Performance Comparison

Our medium-sized project test suite (150 test files, 800 test cases):

| Metric | Jest | Vitest |
|------|------|--------|
| Full run | 28s | 8s |
| Single file | 3.2s | 0.8s |
| Watch mode re-run | 1.8s | 0.3s |
| Startup time | 4.5s | 1.2s |

Over 3x faster, mainly because Vitest leverages Vite's transform pipeline and avoids redundant compilation.

## Migrating from Jest

```typescript
// vitest.config.ts - 兼容 Jest 的全局 API
export default defineConfig({
  test: {
    globals: true,        // 不需要 import { describe } from 'vitest'
    environment: 'jsdom',
    // Jest 的 setupFilesAfterSetup
    setupFiles: ['./vitest.setup.ts'],
    // Jest 的 testMatch
    include: ['**/*.test.{ts,tsx}'],
    // Jest 的 transform
    // 不需要！Vite 已经处理了
  },
});
```

Migration steps:
1. `pnpm add -D vitest`
2. Rename jest.config to vitest.config (the APIs are very similar)
3. Replace `jest.fn()` with `vi.fn()` (most don't need this change when using globals mode)
4. Remove Jest-related dependencies

## Summary

Vitest is not just a drop-in replacement for Jest — it's the native testing solution for the Vite ecosystem. Fast, simple configuration, and deeply integrated with Vite. If your project uses Vite, there's no reason not to migrate.