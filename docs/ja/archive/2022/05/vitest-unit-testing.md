---
title: "Vitest：Vite ネイティブのテストフレームワーク、Jest の終焉？"
date: 2022-05-24 14:31:37
tags:
  - Vite
  - Vitest
readingTime: 3
description: "如果你的项目用 Vite，那 Vitest 就是测试的最优解。和 Vite 共享配置、同一转换管道、原生 ESM 支持——Jest 需要各种 hack 才能做到的事，Vitest 天然支持。"
wordCount: 389
---

如果你的项目用 Vite，那 Vitest 就是测试的最优解。和 Vite 共享配置、同一转换管道、原生 ESM 支持——Jest 需要各种 hack 才能做到的事，Vitest 天然支持。

## クイックスタート

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

## 与 Jest 的 API 兼容

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

大部分 Jest API 可以直接用，迁移成本很低。

## 与 Vite 共享配置

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

路径别名、插件、环境变量——全部自动继承，不需要像 Jest 那样单独配置 `moduleNameMapper`。

## React 组件测试

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

## Snapshot 测试

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

inline snapshot 直接嵌入测试文件，比单独的 `.snap` 文件更直观。

## 测试 UI

```bash
vitest --ui
```

Vitest 自带一个 Web UI，可以查看测试结果、覆盖率、测试用时。比 Jest 的输出更友好。

## Mock 策略

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

## パフォーマンス比較

我们一个中型项目的测试套件（150 个测试文件，800 个测试用例）：

| 指标 | Jest | Vitest |
|------|------|--------|
| 全量执行 | 28s | 8s |
| 单文件运行 | 3.2s | 0.8s |
| watch 模式重跑 | 1.8s | 0.3s |
| 启动时间 | 4.5s | 1.2s |

快了 3 倍以上，主要是因为 Vitest 利用了 Vite 的转换管道，避免了重复编译。

## 从 Jest 迁移

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

迁移步骤：
1. `pnpm add -D vitest`
2. 把 jest.config 改为 vitest.config（API 很像）
3. 把 `jest.fn()` 替换为 `vi.fn()`（大部分用全局模式不需要改）
4. 删除 jest 相关依赖

## まとめ

Vitest 不是 Jest 的简单替代品，而是 Vite 生态的原生测试方案。速度快、配置简单、与 Vite 深度集成。对于用 Vite 的项目，没有理由不迁移。