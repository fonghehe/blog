---
title: "Vitest 4.0 深度解析：元件測試與快照測試的最佳實踐"
date: 2026-06-12 14:26:05
tags:
  - 測試
  - Vitest
readingTime: 1
description: "Vitest 4.0 帶來了顯著的效能提升和更強大的元件測試能力。本文深入探討快照測試、元件測試和並行測試的最佳實踐。"
wordCount: 255
---

Vitest 已經成為前端測試的事實標準之一。4.0 版本在快照測試、元件測試和並行執行方面都有重要改進，讓測試體驗更加流暢。

## 快照測試的演進

快照測試從「爭議性特性」變成了「實用工具」，關鍵在於正確的使用姿勢：

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import UserCard from './UserCard.vue'

describe('UserCard', () => {
  it('matches snapshot for normal user', () => {
    const { container } = render(UserCard, {
      props: {
        user: {
          name: '張三',
          avatar: '/avatars/zhangsan.jpg',
          role: 'developer'
        }
      }
    })
    
    expect(container).toMatchSnapshot()
  })
})
```

### 快照測試的最佳實踐

1. **小型快照優先**：只快照關鍵 UI 片段，不要快照整個頁面
2. **有意義的快照名稱**：使用 `toMatchSnapshot({ customSnapshotIdentifiers })` 新增上下文
3. **定期審查**：不要無腦接受所有快照更新

## 元件測試策略

### 測試層次劃分

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginForm from './LoginForm.vue'

describe('LoginForm', () => {
  // 第一層：純渲染測試
  it('renders all form fields', () => {
    const wrapper = mount(LoginForm)
    expect(wrapper.find('input[name="email"]').exists()).toBe(true)
    expect(wrapper.find('input[name="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  // 第二層：互動測試
  it('emits submit event with form data', async () => {
    const wrapper = mount(LoginForm)
    await wrapper.find('input[name="email"]').setValue('test@example.com')
    await wrapper.find('input[name="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')
    
    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(wrapper.emitted('submit')[0]).toEqual([{
      email: 'test@example.com',
      password: 'password123'
    }])
  })
})
```

## 並行測試優化

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    threads: true,
    maxThreads: 4,
    minThreads: 2,
    isolate: true,
    testTimeout: 10000,
    retry: 2
  }
})
```

## 小結

Vitest 4.0 讓前端測試變得更加快速和可靠。快照測試的關鍵是「小而精」，元件測試的關鍵是「層次分明」，並行測試的關鍵是「隔離狀態」。在實際專案中，合理的測試策略比追求 100% 覆蓋率更重要。
