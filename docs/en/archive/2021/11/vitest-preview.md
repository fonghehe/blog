---
title: "Vitest First Experience: The Vite-Native Unit Testing Framework"
date: 2021-11-15 11:13:44
tags:
  - Vite
  - Testing

readingTime: 2
description: "Vitest made its official debut at the end of 2021 as the testing framework of the Vite ecosystem. As someone migrating a project from Jest, I found its biggest selling point is sharing configuration and transform pipeline with Vite — no extra bundler config, HMR support, and native ESM."
wordCount: 205
---

Vitest officially appeared at the end of 2021 as a testing framework in the Vite ecosystem. Having migrated from Jest, its biggest selling point is sharing Vite's config and transform pipeline—no extra bundler config, HMR support, and native ESM.

## Why Vitest Is Needed

Using Jest in a Vite project isn't smooth:

```
Jest 的问题：
1. Jest 不认 Vite 的别名（@/ → src/）
2. Jest 不支持 Vite 的插件管线（需要单独配置 babel）
3. Jest 不原生支持 ESM，需要 --experimental-vm-modules
4. 两套配置文件，维护成本高
```

Vitest reuses `vite.config.ts` directly, so you can start with zero config.

## Quick Start

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

Vitest automatically reads `vite.config.ts`, so no extra config is needed. To override it:

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

## Writing Tests

The API is almost fully compatible with Jest:

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

## Vue Component Testing

With `@vue/test-utils`, the usage is the same as in Jest:

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

## Mocking

Vitest ships a built-in `vi` object that provides mocking:

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

## Performance Comparison

Measured data from our component library project:

```
项目规模：120 个测试文件，约 800 个测试用例

Jest：      ~18s
Vitest：    ~4s

vitest --watch 的 HMR 响应：约 200ms
```

The performance gain mainly comes from Vite's esbuild pre-bundling and native ESM support.

## Summary

- Vitest shares config with Vite, so you can start with zero config and the learning curve is low
- Its API is highly compatible with Jest, so migration cost is low
- It outperforms Jest significantly, especially in large projects
- The built-in UI (`--ui`) makes debugging a better experience
- It's still iterating quickly, but the core features are already stable and usable
- If your project uses Vite, Vitest is the most natural testing choice
