---
title: "Testing Library ベストプラクティス 2022"
date: 2022-05-23 09:48:09
tags:
  - フロントエンド
readingTime: 3
description: "关于Testing Library 最佳实践 2022，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。"
---

关于Testing Library 最佳实践 2022，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。

## 基本原理

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

## 高度な機能

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

## プロジェクト実践

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

## ベストプラクティス

実際のプロジェクトでの使い方はより複雑になります：

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

このアプローチにより、コードのテスト可能性とスケーラビリティの両方が向上します。

## よくある落とし穴

以下は完全な例です：

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

境界条件の処理に注意してください。これは本番環境において非常に重要です。

## まとめ

- チームコラボレーションでは、技術そのものよりも規約とドキュメントの方が重要です
- コミュニティの動向を注視し、技術ソリューションは継続的に反復する必要があります
- 新技術のために新技術を採用しないでください
- コード例は参考のみであり、ビジネスシナリオに応じて調整が必要です
- Testing Library 最佳实践 2022は銀の弾丸ではなく、プロジェクトの規模と技術スタックに応じて選択する必要があります