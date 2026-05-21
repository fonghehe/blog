---
title: "Playwright E2E Cross-Browser Testing"
date: 2021-07-01 09:31:07
tags:
  - Testing
  - Engineering

readingTime: 2
description: "关于Playwright E2E 跨浏览器测试，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspectiv"
wordCount: 202
---

关于Playwright E2E 跨浏览器测试，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspective.

## Basic Principles

实际项目中的用法会更复杂一些：

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

Through this approach, both the testability and scalability of the code are improved.

## Advanced Features

Here is a complete example:

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

Pay attention to boundary condition handling, which is critical in production.

## Project Practice

The key lies in understanding the core logic:

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

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Best Practices

We can improve it in the following ways:

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

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- Code examples are for reference only and need to be adjusted according to your business scenario
- Playwright E2E 跨浏览器测试不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production
- In team collaboration, conventions and documentation are more important than the technology itself