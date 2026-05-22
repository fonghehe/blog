---
title: "Vitest：Vite ネイティブのテストフレームワーク、Jest の終焉？"
date: 2022-05-24 14:31:37
tags:
  - Vite
  - Vitest
readingTime: 4
description: "プロジェクトで Vite を使っているなら、Vitest がテストの最適解です。Vite と設定を共有し、同一の変換パイプラインを持ち、ネイティブ ESM をサポートします。Jest では様々なハックが必要だったことが、Vitest ではネイティブにサポートされています。"
wordCount: 631
---

プロジェクトで Vite を使っているなら、Vitest がテストの最適解です。Vite と設定を共有し、同一の変換パイプラインを持ち、ネイティブ ESM をサポートします。Jest では様々なハックが必要だったことが、Vitest ではネイティブにサポートされています。

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

## Jest との API 互換性

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

ほとんどの Jest API はそのまま使用でき、移行コストは非常に低いです。

## Vite との設定共有

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
    // テスト専用設定
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

パスエイリアス、プラグイン、環境変数——すべて自動で継承され、Jest のように `moduleNameMapper` を個別に設定する必要はありません。

## React コンポーネントのテスト

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

## スナップショットテスト

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

inline snapshot はテストファイルに直接埋め込まれ、個別の `.snap` ファイルよりも直感的です。

## テスト UI

```bash
vitest --ui
```

Vitest には Web UI が付属しており、テスト結果、カバレッジ、テスト所要時間を確認できます。Jest の出力よりも親しみやすいです。

## Mock 戦略

```typescript
// サードパーティモジュールの Mock
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { users: [] } }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

// モジュールの一部を Mock
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils');
  return {
    ...actual,
    formatDate: vi.fn().mockReturnValue('2022-01-01'),
  };
});

// CSS モジュールの Mock
vi.mock('*.module.css', () => ({
  default: { container: 'mock-container' },
}));

// 画像の Mock
vi.mock('*.svg', () => ({
  default: 'mock-svg-url',
}));
```

## パフォーマンス比較

私たちがある中規模プロジェクトのテストスイート（150 テストファイル、800 テストケース）で測定したデータ：

| 指標 | Jest | Vitest |
|------|------|--------|
| 全量実行 | 28s | 8s |
| 単一ファイル実行 | 3.2s | 0.8s |
| watch モード再実行 | 1.8s | 0.3s |
| 起動時間 | 4.5s | 1.2s |

3 倍以上高速です。主な理由は Vitest が Vite の変換パイプラインを利用し、重複コンパイルを回避しているためです。

## Jest からの移行

```typescript
// vitest.config.ts - Jest のグローバル API と互換
export default defineConfig({
  test: {
    globals: true,        // import { describe } from 'vitest' が不要
    environment: 'jsdom',
    // Jest の setupFilesAfterSetup に相当
    setupFiles: ['./vitest.setup.ts'],
    // Jest の testMatch に相当
    include: ['**/*.test.{ts,tsx}'],
    // Jest の transform
    // 不要！Vite がすでに処理している
  },
});
```

移行手順：
1. `pnpm add -D vitest`
2. jest.config を vitest.config に変更（API は非常に似ています）
3. `jest.fn()` を `vi.fn()` に置き換え（ほとんどの場合、グローバルモードでは変更不要）
4. Jest 関連の依存関係を削除

## まとめ

Vitest は Jest の単純な代替品ではなく、Vite エコシステムのネイティブなテストソリューションです。高速で、設定が簡単で、Vite と深く統合されています。Vite を使用しているプロジェクトでは、移行しない理由はありません。
