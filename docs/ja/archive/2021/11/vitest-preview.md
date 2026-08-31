---
title: "Vitest 初体験：Vite ネイティブのユニットテストフレームワーク"
date: 2021-11-15 11:13:44
tags:
  - Vite
  - テスト

readingTime: 3
description: "Vitest 在 2021 年底作为 Vite 生态的测试框架正式亮相。作为一个从 Jest 迁移过来的项目，Vitest 最大的卖点是和 Vite 共享配置和转换管线——不需要额外的打包配置，HMR 支持，以及原生 ESM。"
wordCount: 523
---

Vitest は 2021 年末に Vite エコシステムのテストフレームワークとして正式に登場した。Jest から移行してきたプロジェクトにとって、最大の売りは Vite と設定や変換パイプラインを共有することだ――別途バンドル設定は不要で、HMR にも対応し、ネイティブな ESM もサポートする。

## なぜ Vitest が必要か

Vite のプロジェクトで Jest を使うのはスムーズではない：

```
Jest 的问题：
1. Jest 不认 Vite 的别名（@/ → src/）
2. Jest 不支持 Vite 的插件管线（需要单独配置 babel）
3. Jest 不原生支持 ESM，需要 --experimental-vm-modules
4. 两套配置文件，维护成本高
```

Vitest は `vite.config.ts` をそのまま流用でき、設定ゼロで始められる。

## クイックスタート

```bash
npm install -D vitest

# package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

Vitest は `vite.config.ts` を自動で読み込み、追加の設定は不要だ。上書きしたい場合は：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,         // 使用全局 API（describe, it, expect）
    environment: 'jsdom',  // 或 'happy-dom'，更快
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
```

## テストの記述

API は Jest とほぼ完全に互換性がある：

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('应该正确格式化人民币', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
  })

  it('应该处理负数', () => {
    expect(formatCurrency(-99.9)).toBe('-¥99.90')
  })

  it('应该处理零', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('应该格式化为 YYYY-MM-DD', () => {
    const date = new Date(2021, 10, 15)
    expect(formatDate(date)).toBe('2021-11-15')
  })
})
```

## Vue コンポーネントテスト

`@vue/test-utils` を使い、Jest と同じ使い方だ：

```typescript
// src/components/Button.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('应该渲染插槽内容', () => {
    const wrapper = mount(Button, {
      slots: { default: '点击我' }
    })
    expect(wrapper.text()).toContain('点击我')
  })

  it('点击时应该触发 click 事件', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disabled 状态不应该触发事件', async () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
```

## Mock 功能

Vitest には `vi` オブジェクトが組み込まれており、モック機能を提供する：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 模块
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: '张三' })
}))

// Mock 定时器
vi.useFakeTimers()

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在 3 秒后刷新用户数据', async () => {
    const { fetchUser } = await import('./api')
    // ... 测试逻辑
    vi.advanceTimersByTime(3000)
    expect(fetchUser).toHaveBeenCalledTimes(2)
  })
})
```

## パフォーマンス比較

自社のコンポーネントライブラリプロジェクトでの実測データ：

```
项目规模：120 个测试文件，约 800 个测试用例

Jest：      ~18s
Vitest：    ~4s

vitest --watch 的 HMR 响应：约 200ms
```

性能向上の主因は、Vite の esbuild によるプリビルドとネイティブ ESM サポートだ。

## まとめ

- Vitest は Vite と設定を共有し、ゼロコンフィグで始められ、学習コストも低い
- API は Jest と高い互換性があり、移行コストは小さい
- 性能は Jest を大きく上回り、特に大規模プロジェクトで顕著だ
- 組み込みの UI（`--ui`）によりデバッグ体験が向上する
- 現在も急速に開発が進んでいるが、コア機能はすでに安定して使える
- プロジェクトが Vite を使っているなら、Vitest が最も自然なテスト手法の選択肢だ