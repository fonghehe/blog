---
title: "Playwright 2.0 多瀏覽器自動化測試架構"
date: 2026-06-28 10:03:19
tags:
  - 測試
readingTime: 1
description: "Playwright 2.0 支援所有主流瀏覽器，提供了強大的自動化測試能力。本文討論 Playwright 的架構設計、測試策略和 CI/CD 整合。"
wordCount: 182
---

Playwright 已經成為前端端對端測試的首選工具。2026 年的 Playwright 2.0 不僅支援所有主流瀏覽器，還提供了更好的除錯能力和 CI/CD 整合。

## Playwright 架構

```
測試程式碼 → Playwright API → 瀏覽器驅動程式 → 瀏覽器實例
                    ↓
              瀏覽器上下文（隔離的環境）
```

每個測試在獨立的瀏覽器上下文中執行，確保測試隔離。

## 基礎測試結構

```typescript
import { test, expect } from '@playwright/test';

test.describe('使用者登入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('成功登入', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toHaveText('歡迎回來');
  });

  test('密碼錯誤顯示提示', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'wrong');
    await page.click('[data-testid="submit"]');
    
    await expect(page.locator('.error-message')).toHaveText('密碼錯誤');
  });
});
```

## 多瀏覽器測試

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
```

## 頁面物件模式

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="email"]');
    this.passwordInput = page.locator('[data-testid="password"]');
    this.submitButton = page.locator('[data-testid="submit"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

## 視覺回歸測試

```typescript
import { test, expect } from '@playwright/test';

test('首頁視覺回歸', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

## CI/CD 整合

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run tests
        run: npx playwright test
```

## 小結

Playwright 2.0 是前端端對端測試的最佳選擇。它支援多瀏覽器、提供了強大的除錯能力、與 CI/CD 整合良好。2026 年的測試策略：頁面物件模式組織測試、API 測試驗證後端、視覺回歸測試檢測 UI 變化。
