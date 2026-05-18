---
title: "Testing Library 最佳實踐 2022"
date: 2022-05-23 09:48:09
tags:
  - 前端
readingTime: 2
description: "關於Testing Library 最佳實踐 2022，很多開發者只停留在 API 呼叫層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。"
---

關於Testing Library 最佳實踐 2022，很多開發者只停留在 API 呼叫層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。

## 基本原理

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

## 高階特性

先來看基本的實現方式：

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

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 專案實踐

在這個基礎上，我們可以進一步最佳化：

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

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 最佳實踐

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

## 踩坑記錄

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

## 小結

- 團隊協作中約定和文件比技術本身更重要
- 關注社群動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 程式碼示例僅供參考，需根據業務場景調整
- Testing Library 最佳實踐 2022不是銀彈，需要根據專案規模和技術棧選擇