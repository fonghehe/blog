---
title: "Playwright 2.0 マルチブラウザ自動化テストアーキテクチャ"
date: 2026-06-28 10:03:19
tags:
  - テスト
readingTime: 2
description: "Playwright 2.0 はすべての主要ブラウザをサポートし、強力な自動化テスト能力を提供する。Playwright のアーキテクチャ設計、テスト戦略、CI/CD 統合を議論する。"
wordCount: 313
---

Playwright はフロントエンドのエンドツーエンドテストで最も選ばれるツールとなった。2026 年の Playwright 2.0 はすべての主要ブラウザをサポートするだけでなく、より良いデバッグ能力と CI/CD 統合も提供する。

## Playwright アーキテクチャ

```
テストコード → Playwright API → ブラウザドライバー → ブラウザインスタンス
                        ↓
                  ブラウザコンテキスト（隔離された環境）
```

各テストは独立したブラウザコンテキストで実行され、テストの隔離を保証する。

## 基本テスト構造

```typescript
import { test, expect } from '@playwright/test';

test.describe('ユーザーログイン', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('ログイン成功', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toHaveText('おかえりなさい');
  });

  test('パスワード間違いでエラー表示', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'wrong');
    await page.click('[data-testid="submit"]');
    
    await expect(page.locator('.error-message')).toHaveText('パスワードが間違っています');
  });
});
```

## マルチブラウザテスト

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

## ページオブジェクトパターン

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

## ビジュアルリグレッションテスト

```typescript
import { test, expect } from '@playwright/test';

test('ホームページのビジュアルリグレッション', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

## CI/CD 統合

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

## まとめ

Playwright 2.0 はフロントエンドエンドツーエンドテストの最良の選択だ。マルチブラウザをサポートし、強力なデバッグ能力を提供し、CI/CD と良好に統合される。2026 年のテスト戦略：ページオブジェクトパターンでテストを整理し、API テストでバックエンドを検証し、ビジュアルリグレッションテストで UI 変更を検出する。
