---
title: "Storybook 7.0 預覽與遷移：特性解讀與遷移建議"
date: 2022-05-30 15:09:42
tags:
  - Storybook
readingTime: 2
description: "最近在團隊中落地Storybook 7.0 預覽與遷移，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
wordCount: 295
---

最近在團隊中落地Storybook 7.0 預覽與遷移，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

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

## 深度解析

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

## 落地經驗

先來看基本的實現方式：

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

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 調優策略

在這個基礎上，我們可以進一步優化：

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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 小結

- 不要為了用新技術而用新技術
- 代碼示例僅供參考，需根據業務場景調整
- Storybook 7.0 預覽與遷移不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要