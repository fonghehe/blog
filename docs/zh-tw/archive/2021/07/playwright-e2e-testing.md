---
title: "Playwright E2E 跨瀏覽器測試"
date: 2021-07-01 09:31:07
tags:
  - Playwright
  - 工程化
readingTime: 2
description: "關於Playwright E2E 跨瀏覽器測試，很多開發者只停留在 API 呼叫層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。"
wordCount: 318
---

關於Playwright E2E 跨瀏覽器測試，很多開發者只停留在 API 呼叫層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。

## 基本原理

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

## 高階特性

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

## 專案實踐

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

## 最佳實踐

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

- 程式碼示例僅供參考，需根據業務場景調整
- Playwright E2E 跨瀏覽器測試不是銀彈，需要根據專案規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好相容性驗證
- 團隊協作中約定和文件比技術本身更重要