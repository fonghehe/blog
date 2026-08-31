---
title: "Jest Past and Present: The Vision for a Vite-Native Test Framework"
date: 2021-03-15 11:13:15
tags:
  - Vite
  - Testing

readingTime: 3
description: "A question has been circulating in the community: if Vite already solves dev and build, why does testing still need a separate toolchain that knows nothing about Vite? Tests run in Node with Jest's transform config, dragging the whole Babel/TypeScript compilation story back in. What if tests could reuse Vite's pipeline directly?"
wordCount: 452
---

The community has been discussing a question lately: now that Vite handles both development and builds, why does the testing step still need a separate toolchain completely unrelated to Vite? Tests run on Node using Jest's transform config, which brings back the whole Babel/TypeScript compilation dance. What if tests could also reuse Vite's module resolution and transformation?

## Pain Points of Existing Test Tools

Running a Vite project with Jest means complex, error-prone configuration:

```javascript
// jest.config.js —— 一个 Vite + Vue 3 + TypeScript 项目的典型配置
module.exports = {
  // 需要配置 transform 来处理 TS
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue3-jest'
  },

  // 需要配置模块别名（和 vite.config.ts 重复）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 需要配置文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'vue'],

  // 需要配置环境
  testEnvironment: 'jsdom',

  // CSS 文件要 mock
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(png|jpg|svg)$': '<rootDir>/__mocks__/fileMock.js'
  }
}
```

A few problems stand out:

1. **Duplicated config**: aliases, CSS preprocessing, and TS transforms are configured once in `vite.config.ts` and again in `jest.config.js`
2. **Different transform pipelines**: Vite compiles with esbuild while Jest uses Babel/ts-jest, so the two compilation results can diverge
3. **Hard to debug**: tests and development use different toolchains, making issues harder to trace

## Reusing Vite's Design Philosophy

The core idea is straightforward: let tests go through Vite's module-handling pipeline. Vite already has a transform pipeline that handles TypeScript, Vue SFCs, CSS Modules, static assets, and more—tests just need to reuse it.

```
现有的工具链：
  开发: Vite (esbuild) → 浏览器
  测试: Jest (Babel/ts-jest) → Node/JSDOM
  构建: Vite (Rollup) → 生产

理想状态：
  开发: Vite → 浏览器
  测试: Vite → Node/JSDOM
  构建: Vite → 生产
```

Building on this idea, we can design a Vite-native test runner. The key is to use Vite's `createServer` API for module transformation:

```javascript
// 概念验证：用 Vite 做测试的模块加载器
import { createServer } from 'vite'

async function createTestRunner() {
  // 复用项目的 vite.config.ts
  const server = await createServer({
    // 不需要启动 HTTP 服务
    server: { middlewareMode: true },
    // 测试环境配置
    optimizeDeps: { disabled: true },
    // 覆盖一些配置
    mode: 'test'
  })

  // 利用 Vite 的 transform 能力处理模块
  async function loadModule(filepath) {
    // Vite 会处理 TS、Vue SFC、CSS 等
    const result = await server.transformRequest(filepath)
    // 在 Node 中执行
    return executeInNode(result.code)
  }

  return { loadModule, close: () => server.close() }
}
```

## Hypothetical API Design

If we were to design a Vite-native test framework, what should its API look like?

```typescript
// jest.config.ts —— 直接复用 Vite 配置
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,          // 全局 API（describe/it/expect）
    environment: 'jsdom',   // 或 'happy-dom'
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules'],
    coverage: {
      provider: 'c8',       // 或 'istanbul'
      reporter: ['text', 'html']
    }
  }
})
```

Test files are written much like Jest's, but without the extra configuration:

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'jest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('should format number to currency', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
  })

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('should format date to yyyy-MM-dd', () => {
    const date = new Date(2021, 2, 15)
    expect(formatDate(date)).toBe('2021-03-15')
  })
})
```

Component testing:

```typescript
// src/components/Button.test.ts
import { describe, it, expect } from 'jest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' }
    })
    expect(wrapper.text()).toContain('Click me')
  })

  it('emits click event', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disables when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

## Comparison with Existing Solutions

| Dimension | Jest | Future approach (Vite-native) |
|----------|------|------------------------------|
| Config | Standalone config, duplicated with Vite | Inherits `vite.config.ts` |
| Transform | Babel/ts-jest | Vite transform (esbuild) |
| Speed | Moderate | Expected faster (esbuild compilation) |
| Ecosystem | Mature (jest-dom, msw, etc.) | Needs a compatibility layer |
| Module handling | Mostly CommonJS | Native ESM |
| Mocking | jest.mock() | import.meta.jest or similar |

## Future Outlook

A few directions are worth watching:

1. **Compile test files with esbuild**: far faster than Babel, with TypeScript support out of the box
2. **Native ESM**: no need for a `transform` step to convert ESM to CJS; tests run ESM directly
3. **Jest compatibility**: the upper-layer API stays compatible with Jest, keeping migration costs low
4. **JSDOM / happy-dom**: unified DOM environment management
5. **Leverage Vite HMR in watch mode**: use Vite's HMR pipeline to update incrementally when files change

If the community pulls this off, the frontend toolchain could achieve full Vite coverage in the second half of 2021—development, testing, and builds all driven by a single config.

## Summary

- Today's test toolchain is disconnected from Vite's dev toolchain, with duplicated config and mismatched compilers
- The core idea is to reuse Vite's transform pipeline so tests also compile through esbuild
- On the API side, inheriting `vite.config.ts` reduces duplicate configuration
- Jest's ecosystem is mature, so the new approach needs a compatibility layer (Jest's `describe`/`it`/`expect` API)
- This direction is worth looking forward to and may materialize in the second half of 2021