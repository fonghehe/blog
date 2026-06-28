---
title: "Playwright 2.0 多浏览器自动化测试架构"
date: 2026-06-28 10:03:19
tags:
  - 测试
  - Playwright
readingTime: 3
description: "Playwright 2.0 支持所有主流浏览器，提供了强大的自动化测试能力。本文讨论 Playwright 的架构设计、测试策略和 CI/CD 集成。"
wordCount: 353
---

Playwright 已经成为前端端到端测试的首选工具。2026 年的 Playwright 2.0 不仅支持所有主流浏览器，还提供了更好的调试能力和 CI/CD 集成。

## Playwright 架构

Playwright 的核心架构：

```
测试代码 → Playwright API → 浏览器驱动 → 浏览器实例
                    ↓
              浏览器上下文（隔离的环境）
```

每个测试运行在独立的浏览器上下文中，确保测试隔离。

## 基础测试结构

```typescript
import { test, expect } from '@playwright/test';

test.describe('用户登录', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('成功登录', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toHaveText('欢迎回来');
  });

  test('密码错误显示提示', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'wrong');
    await page.click('[data-testid="submit"]');
    
    await expect(page.locator('.error-message')).toHaveText('密码错误');
  });
});
```

## 多浏览器测试

Playwright 支持 Chromium、Firefox 和 WebKit：

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' }
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' }
    }
  ]
});
```

运行特定浏览器：

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## 页面对象模式

页面对象模式让测试更易维护：

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="email"]');
    this.passwordInput = page.locator('[data-testid="password"]');
    this.submitButton = page.locator('[data-testid="submit"]');
    this.errorMessage = page.locator('.error-message');
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

// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('用户登录', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');
  
  await expect(page).toHaveURL('/dashboard');
});
```

## API 测试

Playwright 也可以测试后端 API：

```typescript
import { test, expect } from '@playwright/test';

test('获取用户列表', async ({ request }) => {
  const response = await request.get('/api/users');
  
  expect(response.ok()).toBeTruthy();
  
  const users = await response.json();
  expect(users).toHaveLength(10);
  expect(users[0]).toHaveProperty('id');
  expect(users[0]).toHaveProperty('name');
});

test('创建用户', async ({ request }) => {
  const response = await request.post('/api/users', {
    data: {
      name: 'Alice',
      email: 'alice@example.com'
    }
  });
  
  expect(response.ok()).toBeTruthy();
  
  const user = await response.json();
  expect(user.name).toBe('Alice');
});
```

## 视觉回归测试

Playwright 支持视觉回归测试：

```typescript
import { test, expect } from '@playwright/test';

test('首页视觉回归', async ({ page }) => {
  await page.goto('/');
  
  // 截图对比
  await expect(page).toHaveScreenshot('homepage.png');
});

test('登录页面视觉回归', async ({ page }) => {
  await page.goto('/login');
  
  // 只截图特定区域
  await expect(page.locator('.login-form')).toHaveScreenshot('login-form.png');
});
```

更新截图：

```bash
npx playwright test --update-snapshots
```

## 调试技巧

**技巧 1：Playwright Inspector**

```bash
npx playwright test --debug
```

**技巧 2：代码生成**

```bash
npx playwright codegen https://example.com
```

**技巧 3：慢速模式**

```bash
npx playwright test --headed --slow-motion=1000
```

**技巧 4：追踪**

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry'
  }
});
```

查看追踪：

```bash
npx playwright show-trace trace.zip
```

## CI/CD 集成

**GitHub Actions**

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
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**并行执行**

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : 4
});
```

## 性能优化

**优化 1：减少页面加载时间**

```typescript
test('快速加载', async ({ page }) => {
  // 等待网络空闲
  await page.goto('/', { waitUntil: 'networkidle' });
  
  // 或者只等待特定资源
  await page.goto('/');
  await page.waitForSelector('[data-testid="main-content"]');
});
```

**优化 2：复用登录状态**

```typescript
// storage-state.json
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="submit"]');
  
  await context.storageState({ path: 'storage-state.json' });
  await context.close();
});

test.use({ storageState: 'storage-state.json' });
```

**优化 3：并行测试**

```typescript
// tests/parallel.spec.ts
import { test } from '@playwright/test';

// 这些测试会并行运行
test('测试 A', async ({ page }) => { ... });
test('测试 B', async ({ page }) => { ... });
test('测试 C', async ({ page }) => { ... });
```

## 常见问题

**问题 1：元素找不到**

```typescript
// 检查元素是否存在
const element = page.locator('[data-testid="submit"]');
await element.waitFor({ state: 'visible', timeout: 5000 });
```

**问题 2：测试不稳定**

```typescript
// 使用自动等待
await expect(page.locator('.message')).toHaveText('成功');

// 而不是
await page.waitForTimeout(1000);
```

**问题 3：CI 环境差异**

```typescript
// 使用固定的视口大小
test.use({ viewport: { width: 1280, height: 720 } });

// 使用固定的设备像素比
test.use({ deviceScaleFactor: 1 });
```

## 小结

Playwright 2.0 是前端端到端测试的最佳选择。它支持多浏览器、提供了强大的调试能力、与 CI/CD 集成良好。2026 年的测试策略：页面对象模式组织测试、API 测试验证后端、视觉回归测试检测 UI 变化。好的测试是高质量软件的保障。
