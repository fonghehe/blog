---
title: "Playwright 元件測試指南"
date: 2023-05-04 10:05:09
tags:
  - Playwright
readingTime: 2
description: "Playwright 元件測試指南這個話題社群討論了很多次，但隨著版本迭代，很多結論需要更新。本文基於最新版本重新梳理。"
wordCount: 309
---

Playwright 元件測試指南這個話題社群討論了很多次，但隨著版本迭代，很多結論需要更新。本文基於最新版本重新梳理。

## 入門指南

實際專案中的用法會更復雜一些：

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('提交有效的登入表單', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/郵箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密碼/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登入/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 原始碼分析

以下是一個完整的示例：

```javascript
import { test, expect } from '@playwright/test'

test.describe('使用者登入流程', () => {
  test('成功登入跳轉到首頁', async ({ page }) => {
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
  it('提交有效的登入表單', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/郵箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密碼/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登入/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

效能最佳化需要結合具體場景，不是所有情況都需要過度最佳化。

## 最佳化技巧

我們可以通過以下方式來改進：

```javascript
import { test, expect } from '@playwright/test'

test.describe('使用者登入流程', () => {
  test('成功登入跳轉到首頁', async ({ page }) => {
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
- 程式碼示例僅供參考，需根據業務場景調整
- Playwright 元件測試指南不是銀彈，需要根據專案規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好相容性驗證