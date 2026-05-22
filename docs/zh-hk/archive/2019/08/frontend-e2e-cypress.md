---
title: "Cypress E2E 測試入門與實踐：實踐方法與治理思路"
date: 2019-08-09 09:44:05
tags:
  - 測試
readingTime: 4
description: "前端自動化測試一直是團隊落地的難點。單元測試覆蓋不到用户真實操作流程，Selenium 又設定複雜、運行不穩定。Cypress 是一個專門為現代前端應用設計的 E2E 測試框架，開箱即用、API 簡潔、自帶自動重試機製，是目前社區中非常受歡迎的選擇。本文將從零搭建 Cypress 測試環境，逐步覆蓋核心功能。"
wordCount: 521
---

前端自動化測試一直是團隊落地的難點。單元測試覆蓋不到用户真實操作流程，Selenium 又設定複雜、運行不穩定。Cypress 是一個專門為現代前端應用設計的 E2E 測試框架，開箱即用、API 簡潔、自帶自動重試機製，是目前社區中非常受歡迎的選擇。本文將從零搭建 Cypress 測試環境，逐步覆蓋核心功能。

## 安裝與初始化

```bash
npm install --save-dev cypress
```

在 `package.json` 中添加腳本：

```json
{
  "scripts": {
    "cypress:open": "cypress open",
    "cypress:run": "cypress run"
  }
}
```

首次運行 `npx cypress open` 會自動創建以下目錄結構：

```
cypress/
├── fixtures/       # 測試數據
├── integration/    # 測試用例
├── plugins/        # 插件配置
└── support/        # 輔助函數和命令
```

## 第一個測試用例

創建 `cypress/integration/home.spec.js`：

```js
describe('首頁測試', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('應該正確渲染頁面標題', () => {
    cy.get('h1').should('contain', '歡迎');
  });

  it('應該能點擊導航鏈接', () => {
    cy.get('[data-testid="nav-about"]').click();
    cy.url().should('include', '/about');
  });

  it('應該能搜索內容', () => {
    cy.get('[data-testid="search-input"]')
      .type('Cypress')
      .should('have.value', 'Cypress');

    cy.get('[data-testid="search-btn"]').click();

    cy.get('[data-testid="search-results"]')
      .should('have.length.greaterThan', 0);
  });
});
```

## 核心 API 詳解

### 元素選擇

Cypress 使用 jQuery 選擇器語法，推薦使用 `data-testid` 作為選擇器：

```js
// 推薦：使用 data-testid，不受樣式或結構調整影響
cy.get('[data-testid="submit-button"]')

// 也可以使用 CSS 選擇器
cy.get('.btn-primary')
cy.get('#login-form')
cy.get('form > button[type="submit"]')

// 包含文本選擇
cy.contains('提交')
cy.contains('button', '登錄')
```

### 斷言

Cypress 內置了 Chai 斷言庫，支持 BDD 風格的 `should` 和 `expect`：

```js
// 元素存在性
cy.get('.error-msg').should('exist');
cy.get('.loading').should('not.exist');

// 文本內容
cy.get('.title').should('contain', '歡迎');
cy.get('.title').should('have.text', '歡迎來到我的網站');

// 屬性和類名
cy.get('input').should('have.value', 'test');
cy.get('.card').should('have.class', 'active');
cy.get('a').should('have.attr', 'href', '/about');

// 數量
cy.get('.list-item').should('have.length', 5);
cy.get('.card').should('have.length.greaterThan', 0);

// 可見性
cy.get('.modal').should('be.visible');
cy.get('.hidden-element').should('not.be.visible');

// CSS 樣式
cy.get('.btn').should('have.css', 'color', 'rgb(0, 123, 255)');
```

### 交互操作

```js
// 點擊
cy.get('.btn').click();
cy.get('.btn').dblclick();
cy.get('.btn').rightclick();

// 輸入
cy.get('input').type('Hello World');
cy.get('input').clear().type('new value');

// 表單
cy.get('select').select('選項一');
cy.get('[type="checkbox"]').check();
cy.get('[type="checkbox"]').uncheck();
cy.get('[type="radio"]').check();

// 滾動
cy.get('.long-list').scrollTo('bottom');
cy.scrollTo(0, 500);
```

## 處理異步操作

Cypress 的核心設計理念之一是自動重試，大多數命令都會自動重試直到斷言通過或超時。

### 網絡請求

```js
// 攔截 API 請求
describe('用户列表', () => {
  it('應該加載並顯示用户數據', () => {
    // 使用 cy.server 和 cy.route 攔截請求
    cy.server();
    cy.route('GET', '/api/users', 'fixture:users.json').as('getUsers');

    cy.visit('/users');

    // 等待請求完成
    cy.wait('@getUsers');

    // 驗證頁面渲染
    cy.get('[data-testid="user-row"]').should('have.length', 10);
  });

  it('應該處理請求失敗', () => {
    cy.server();
    cy.route({
      method: 'GET',
      url: '/api/users',
      status: 500,
      response: { error: '服務器錯誤' },
    }).as('getUsersError');

    cy.visit('/users');
    cy.wait('@getUsersError');

    cy.get('.error-message').should('contain', '服務器錯誤');
  });
});
```

### 使用 fixtures 模擬數據

創建 `cypress/fixtures/users.json`：

```json
[
  { "id": 1, "name": "張三", "email": "zhangsan@example.com" },
  { "id": 2, "name": "李四", "email": "lisi@example.com" },
  { "id": 3, "name": "王五", "email": "wangwu@example.com" }
]
```

```js
it('應該顯示 fixture 數據', () => {
  cy.server();
  cy.route('GET', '/api/users', 'fixture:users.json').as('getUsers');

  cy.visit('/users');
  cy.wait('@getUsers');

  cy.get('[data-testid="user-name"]').first().should('contain', '張三');
});
```

## 自定義命令

在 `cypress/support/commands.js` 中定義自定義命令，封裝重複操作：

```js
// 登錄命令
Cypress.Commands.add('login', (email = 'test@example.com', password = 'password123') => {
  cy.request({
    method: 'POST',
    url: '/api/login',
    body: { email, password },
  }).then((response) => {
    window.localStorage.setItem('token', response.body.token);
  });
});

// 快速填寫表單
Cypress.Commands.add('fillForm', (formData) => {
  Object.entries(formData).forEach(([name, value]) => {
    cy.get(`[name="${name}"]`).clear().type(value);
  });
});

// 等待元素出現
Cypress.Commands.add('waitForElement', (selector, timeout = 10000) => {
  cy.get(selector, { timeout }).should('be.visible');
});
```

使用自定義命令：

```js
describe('需要登錄的頁面', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/dashboard');
  });

  it('應該顯示用户信息', () => {
    cy.get('[data-testid="user-name"]').should('be.visible');
  });

  it('應該能提交表單', () => {
    cy.fillForm({
      title: '測試標題',
      content: '測試內容',
    });
    cy.get('[data-testid="submit"]').click();
    cy.get('.success-message').should('contain', '提交成功');
  });
});
```

## 頁面對象模式

當測試用例增多時，可以使用頁面對象模式組織代碼：

```js
// cypress/pages/LoginPage.js
class LoginPage {
  visit() {
    cy.visit('/login');
  }

  fillEmail(email) {
    cy.get('[data-testid="email-input"]').clear().type(email);
  }

  fillPassword(password) {
    cy.get('[data-testid="password-input"]').clear().type(password);
  }

  submit() {
    cy.get('[data-testid="login-btn"]').click();
  }

  login(email, password) {
    this.fillEmail(email);
    this.fillPassword(password);
    this.submit();
  }

  getErrorMessage() {
    return cy.get('[data-testid="error-message"]');
  }
}

export default new LoginPage();
```

```js
// 測試用例
import LoginPage from '../pages/LoginPage';

describe('登錄功能', () => {
  beforeEach(() => {
    LoginPage.visit();
  });

  it('成功登錄後跳轉到首頁', () => {
    LoginPage.login('admin@example.com', 'admin123');
    cy.url().should('include', '/dashboard');
  });

  it('錯誤的密碼應該顯示錯誤信息', () => {
    LoginPage.login('admin@example.com', 'wrong');
    LoginPage.getErrorMessage().should('contain', '密碼錯誤');
  });
});
```

## 設定檔案

`cypress.json` 常用配置：

```json
{
  "baseUrl": "http://localhost:3000",
  "viewportWidth": 1280,
  "viewportHeight": 720",
  "defaultCommandTimeout": 10000,
  "requestTimeout": 10000,
  "responseTimeout": 30000",
  "video": false,
  "screenshotOnRunFailure": true,
  "fixturesFolder": "cypress/fixtures",
  "integrationFolder": "cypress/integration",
  "supportFile": "cypress/support/index.js"
}
```

## 集成到 CI/CD

在 CI 環境中使用 `cypress run` 而非 `cypress open`：

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  cypress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '12'
      - run: npm install
      - run: npm run build
      - name: Run E2E tests
        run: |
          npm start &
          npx wait-on http://localhost:3000
          npx cypress run
      - name: Upload screenshots on failure
        uses: actions/upload-artifact@v1
        if: failure()
        with:
          name: cypress-screenshots
          path: cypress/screenshots
```

## 小結

- Cypress 是一個專為前端設計的 E2E 測試框架，開箱即用，無需 WebDriver
- 自動重試機製讓測試更穩定，不需要手動添加 `sleep` 或 `wait`
- 推薦使用 `data-testid` 作為選擇器，避免測試因樣式變化而失敗
- 使用 fixtures 模擬 API 數據，讓測試不依賴後端環境
- 自定義命令和頁面對象模式可以有效組織測試代碼，減少重複
- CI 集成時使用 `cypress run`（無頭模式），配合 `wait-on` 確保應用就緒後再執行測試
- 注意合理設置超時時間和 viewport 大小，適應不同場景
