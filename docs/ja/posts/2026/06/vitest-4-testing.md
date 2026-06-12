---
title: "Vitest 4.0 深度解析：コンポーネントテストとスナップショットテストのベストプラクティス"
date: 2026-06-12 14:26:05
tags:
  - テスト
  - Vitest
readingTime: 2
description: "Vitest 4.0 は大幅なパフォーマンス向上とより強力なコンポーネントテスト機能をもたらした。スナップショットテスト、コンポーネントテスト、並列テストのベストプラクティスを深く解説する。"
wordCount: 474
---

Vitest はフロントエンドテストの事実上の標準の一つとなっている。4.0 バージョンは、スナップショットテスト、コンポーネントテスト、並列実行の面で重要な改善をもたらし、テスト体験をよりスムーズにした。

## スナップショットテストの進化

スナップショットテストは「論争の的となる機能」から「実用的なツール」に進化した。鍵は正しい使い方だ：

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import UserCard from './UserCard.vue'

describe('UserCard', () => {
  it('matches snapshot for normal user', () => {
    const { container } = render(UserCard, {
      props: {
        user: {
          name: '太郎',
          avatar: '/avatars/taro.jpg',
          role: 'developer'
        }
      }
    })
    
    expect(container).toMatchSnapshot()
  })
})
```

### スナップショットテストのベストプラクティス

1. **小さなスナップショットを優先**：重要な UI フラグメントだけをスナップショットし、ページ全体はしない
2. **意味のあるスナップショット名**：`toMatchSnapshot({ customSnapshotIdentifiers })` でコンテキストを追加
3. **定期的にレビュー**：スナップショットの更新を盲目的に受け入れない

```typescript
// 良い例：小さく、意味のあるスナップショット
it('renders loading state correctly', () => {
  const { container } = render(Button, { props: { loading: true } })
  expect(container.querySelector('.loading-spinner')).toMatchSnapshot()
})

// 悪い例：大きく、曖昧なスナップショット
it('renders correctly', () => {
  const { container } = render(ComplexPage)
  expect(container).toMatchSnapshot()  // 大きすぎてメンテナンスが困難
})
```

## コンポーネントテスト戦略

### テスト層の分割

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginForm from './LoginForm.vue'

describe('LoginForm', () => {
  // 第 1 層：純粋なレンダリングテスト
  it('renders all form fields', () => {
    const wrapper = mount(LoginForm)
    expect(wrapper.find('input[name="email"]').exists()).toBe(true)
    expect(wrapper.find('input[name="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  // 第 2 層：インタラクションテスト
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

## 並列テストの最適化

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

## まとめ

Vitest 4.0 により、フロントエンドテストがより高速で信頼性の高いものになった。スナップショットテストの鍵は「小さく正確に」、コンポーネントテストの鍵は「明確に層分け」、並列テストの鍵は「状態を分離」することだ。実際のプロジェクトでは、合理的なテスト戦略が 100% カバレッジを追跡するよりも重要だ——テストは動作を検証するためのものであり、数値指標を満たすためのものではない。
