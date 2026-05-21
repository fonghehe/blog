---
title: "Storybook 7.0 プレビューと移行"
date: 2022-05-30 15:09:42
tags:
  - Storybook
readingTime: 2
description: "最近チームでStorybook 7.0 预览与迁移，において多くの経験を積みました。参考のためにまとめましたので、同様の作業をされる方のお役に立てれば幸いです。"
wordCount: 486
---

最近チームでStorybook 7.0 预览与迁移，において多くの経験を積みました。参考のためにまとめましたので、同様の作業をされる方のお役に立てれば幸いです。

## コアコンセプト

コアロジックを理解することが重要です：

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

パフォーマンス最適化は具体的なシナリオに合わせて行う必要があります。すべての場合に過剰な最適化が必要なわけではありません。

## 詳細分析

以下の方法で改善できます：

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

このアプローチは半年以上本番環境で安定して稼働しており、実際に検証されています。

## 実装経験

まず基本的な実装方法から見てみましょう：

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

このコードは基本的な使用方法を示しています。実際のプロジェクトでは、エラー処理とエッジケースも考慮する必要があります。

## 最適化戦略

この基盤の上で、さらに最適化できます：

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

このパターンは大規模プロジェクトで非常に実用的で、メンテナンスコストを大幅に削減できます。

## まとめ

- 新技術のために新技術を採用しないでください
- コード例は参考のみであり、ビジネスシナリオに応じて調整が必要です
- Storybook 7.0 预览与迁移は銀の弾丸ではなく、プロジェクトの規模と技術スタックに応じて選択する必要があります
- APIを暗記するよりも、基盤となる原理を理解する方が重要です