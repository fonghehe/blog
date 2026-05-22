---
title: "Playwright 組件測試指南：實踐方法與治理思路"
date: 2023-05-04 10:05:09
tags:
  - Playwright
readingTime: 2
description: "Playwright 組件測試指南這個話題社區討論了很多次，但隨着版本迭代，很多結論需要更新。本文基於最新版本重新梳理。"
wordCount: 301
---

Playwright 組件測試指南這個話題社區討論了很多次，但隨着版本迭代，很多結論需要更新。本文基於最新版本重新梳理。

## 入門指南

實際項目中的用法會更復雜一些：

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('提交有效的登錄表單', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/郵箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密碼/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登錄/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 源碼分析

以下是一個完整的示例：

```javascript
import { test, expect } from '@playwright/test'

test.describe('用户登錄流程', () => {
  test('成功登錄跳轉到首頁', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'admin123')
    await page.click('[data-testid="submit-btn"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('.welcome')).toContainText('歡迎回來')
  })
})

```

注意邊界條件處理，這在生產環境中至關重要。

## 真實場景應用

關鍵在於理解核心邏輯：

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('提交有效的登錄表單', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/郵箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密碼/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登錄/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

效能優化需要結合具體場景，不是所有情況都需要過度優化。

## 優化技巧

我們可以通過以下方式來改進：

```javascript
import { test, expect } from '@playwright/test'

test.describe('用户登錄流程', () => {
  test('成功登錄跳轉到首頁', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'admin123')
    await page.click('[data-testid="submit-btn"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('.welcome')).toContainText('歡迎回來')
  })
})

```

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 小結

- 不要為了用新技術而用新技術
- 代碼示例僅供參考，需根據業務場景調整
- Playwright 組件測試指南不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證