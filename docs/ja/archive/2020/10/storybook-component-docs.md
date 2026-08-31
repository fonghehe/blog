---
title: "Storybookによるコンポーネントドキュメントとテスト"
date: 2020-10-16 14:57:24
tags:
  - 测试
readingTime: 2
description: "最近チームでStorybook コンポーネントドキュメントとテストを導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 447
---

最近チームで Storybook のコンポーネントドキュメントとテストを導入し、いくつかの経験を蓄積した。参考になれば幸いだ。

## コアコンセプト

以下は全体のサンプルだ：

```javascript
import { test, expect } from '@playwright/test'

test.describe('用户登录流程', () => {
  test('成功登录跳转到首页', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'admin123')
    await page.click('[data-testid="submit-btn"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('.welcome')).toContainText('欢迎回来')
  })
})

```

境界条件の処理に注意せよ。本番環境で極めて重要だ。

## 深掘り解析

重要なのは中核となるロジックを理解することだ：

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('提交有效的登录表单', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/邮箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密码/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登录/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

パフォーマンス最適化は具体的な場面に応じる必要があり、すべてのケースで過度な最適化が必要なわけではない。

## 実装経験

以下の方法で改善できる：

```javascript
import { test, expect } from '@playwright/test'

test.describe('用户登录流程', () => {
  test('成功登录跳转到首页', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'admin123')
    await page.click('[data-testid="submit-btn"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('.welcome')).toContainText('欢迎回来')
  })
})

```

このアプローチは本番で半年以上安定稼働し、実際に検証済みだ。

## チューニング戦略

まずは基本的な実装方法を見てみよう：

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('提交有效的登录表单', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/邮箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密码/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登录/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

このコードは基本的な使い方を示す。実際のプロジェクトではエラー処理と境界条件も考慮が必要だ。

## 注意事項

この基盤の上でさらに最適化できる：

```javascript
import { test, expect } from '@playwright/test'

test.describe('用户登录流程', () => {
  test('成功登录跳转到首页', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'admin123')
    await page.click('[data-testid="submit-btn"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('.welcome')).toContainText('欢迎回来')
  })
})

```

このパターンは大規模プロジェクトで実用的で、保守コストを大幅に削減できる。

## まとめ

- 新技術のために新技術を使ってはならない
- コード例は参考用。実際のビジネス場面に合わせ調整せよ
- Storybook のコンポーネントドキュメントとテストは銀の弾丸ではない。プロジェクト規模と技術スタックに応じて選ぶべきだ
