---
title: "Cypress E2E Testing: Introduction and Practice"
date: 2019-08-09 09:44:05
tags:
  - Testing
readingTime: 4
description: "Front-end automated testing has always been a pain point for teams to adopt. Unit tests don't cover real user flows, while Selenium is complex to configure and flaky to run. Cypress is an end-to-end testing framework built specifically for modern front-end apps: it works out of the box, has a clean API, and retries automatically—which is why it's so popular in the community. This article sets up a Cypress environment from scratch and works through its core features step by step."
wordCount: 327
---

Front-end automated testing has always been a pain point for teams to adopt. Unit tests don't cover real user flows, while Selenium is complex to configure and flaky to run. Cypress is an end-to-end testing framework built specifically for modern front-end apps: it works out of the box, has a clean API, and retries automatically—which is why it's so popular in the community. This article sets up a Cypress environment from scratch and works through its core features step by step.

## Installation and Initialization

```bash
npm install --save-dev cypress
```

Add the following scripts to `package.json`:

```json
{
  "scripts": {
    "cypress:open": "cypress open",
    "cypress:run": "cypress run"
  }
}
```

Running `npx cypress open` for the first time creates the following directory structure:

```
cypress/
├── fixtures/       # 测试数据
├── integration/    # 测试用例
├── plugins/        # 插件配置
└── support/        # 辅助函数和命令
```

## First Test Case

Create `cypress/integration/home.spec.js`:

```js
describe('首页测试', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('应该正确渲染页面标题', () => {
    cy.get('h1').should('contain', '欢迎');
  });

  it('应该能点击导航链接', () => {
    cy.get('[data-testid="nav-about"]').click();
    cy.url().should('include', '/about');
  });

  it('应该能搜索内容', () => {
    cy.get('[data-testid="search-input"]')
      .type('Cypress')
      .should('have.value', 'Cypress');

    cy.get('[data-testid="search-btn"]').click();

    cy.get('[data-testid="search-results"]')
      .should('have.length.greaterThan', 0);
  });
});
```

## Core API Reference

### Selecting Elements

Cypress uses jQuery-style selector syntax; the recommended approach is to select by `data-testid`:

```js
// 推荐：使用 data-testid，不受样式或结构调整影响
cy.get('[data-testid="submit-button"]')

// 也可以使用 CSS 选择器
cy.get('.btn-primary')
cy.get('#login-form')
cy.get('form > button[type="submit"]')

// 包含文本选择
cy.contains('提交')
cy.contains('button', '登录')
```

### Assertions

Cypress bundles the Chai assertion library and supports the BDD-style `should` and `expect`:

```js
// 元素存在性
cy.get('.error-msg').should('exist');
cy.get('.loading').should('not.exist');

// 文本内容
cy.get('.title').should('contain', '欢迎');
cy.get('.title').should('have.text', '欢迎来到我的网站');

// 属性和类名
cy.get('input').should('have.value', 'test');
cy.get('.card').should('have.class', 'active');
cy.get('a').should('have.attr', 'href', '/about');

// 数量
cy.get('.list-item').should('have.length', 5);
cy.get('.card').should('have.length.greaterThan', 0);

// 可见性
cy.get('.modal').should('be.visible');
cy.get('.hidden-element').should('not.be.visible');

// CSS 样式
cy.get('.btn').should('have.css', 'color', 'rgb(0, 123, 255)');
```

### Interactions

```js
// 点击
cy.get('.btn').click();
cy.get('.btn').dblclick();
cy.get('.btn').rightclick();

// 输入
cy.get('input').type('Hello World');
cy.get('input').clear().type('new value');

// 表单
cy.get('select').select('选项一');
cy.get('[type="checkbox"]').check();
cy.get('[type="checkbox"]').uncheck();
cy.get('[type="radio"]').check();

// 滚动
cy.get('.long-list').scrollTo('bottom');
cy.scrollTo(0, 500);
```

## Handling Async Operations

One of Cypress's core design principles is automatic retry: most commands keep retrying until their assertion passes or they time out.

### Network Requests

```js
// 拦截 API 请求
describe('用户列表', () => {
  it('应该加载并显示用户数据', () => {
    // 使用 cy.server 和 cy.route 拦截请求
    cy.server();
    cy.route('GET', '/api/users', 'fixture:users.json').as('getUsers');

    cy.visit('/users');

    // 等待请求完成
    cy.wait('@getUsers');

    // 验证页面渲染
    cy.get('[data-testid="user-row"]').should('have.length', 10);
  });

  it('应该处理请求失败', () => {
    cy.server();
    cy.route({
      method: 'GET',
      url: '/api/users',
      status: 500,
      response: { error: '服务器错误' },
    }).as('getUsersError');

    cy.visit('/users');
    cy.wait('@getUsersError');

    cy.get('.error-message').should('contain', '服务器错误');
  });
});
```

### Mocking Data with Fixtures

Create `cypress/fixtures/users.json`:

```json
[
  { "id": 1, "name": "张三", "email": "zhangsan@example.com" },
  { "id": 2, "name": "李四", "email": "lisi@example.com" },
  { "id": 3, "name": "王五", "email": "wangwu@example.com" }
]
```

```js
it('应该显示 fixture 数据', () => {
  cy.server();
  cy.route('GET', '/api/users', 'fixture:users.json').as('getUsers');

  cy.visit('/users');
  cy.wait('@getUsers');

  cy.get('[data-testid="user-name"]').first().should('contain', '张三');
});
```

## Custom Commands

Define custom commands in `cypress/support/commands.js` to wrap repetitive actions:

```js
// 登录命令
Cypress.Commands.add('login', (email = 'test@example.com', password = 'password123') => {
  cy.request({
    method: 'POST',
    url: '/api/login',
    body: { email, password },
  }).then((response) => {
    window.localStorage.setItem('token', response.body.token);
  });
});

// 快速填写表单
Cypress.Commands.add('fillForm', (formData) => {
  Object.entries(formData).forEach(([name, value]) => {
    cy.get(`[name="${name}"]`).clear().type(value);
  });
});

// 等待元素出现
Cypress.Commands.add('waitForElement', (selector, timeout = 10000) => {
  cy.get(selector, { timeout }).should('be.visible');
});
```

Using the custom commands:

```js
describe('需要登录的页面', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/dashboard');
  });

  it('应该显示用户信息', () => {
    cy.get('[data-testid="user-name"]').should('be.visible');
  });

  it('应该能提交表单', () => {
    cy.fillForm({
      title: '测试标题',
      content: '测试内容',
    });
    cy.get('[data-testid="submit"]').click();
    cy.get('.success-message').should('contain', '提交成功');
  });
});
```

## Page Object Pattern

As test cases grow, you can organize them with the page object pattern:

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
// 测试用例
import LoginPage from '../pages/LoginPage';

describe('登录功能', () => {
  beforeEach(() => {
    LoginPage.visit();
  });

  it('成功登录后跳转到首页', () => {
    LoginPage.login('admin@example.com', 'admin123');
    cy.url().should('include', '/dashboard');
  });

  it('错误的密码应该显示错误信息', () => {
    LoginPage.login('admin@example.com', 'wrong');
    LoginPage.getErrorMessage().should('contain', '密码错误');
  });
});
```

## Configuration File

Common `cypress.json` settings:

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

## Integrating with CI/CD

In CI, use `cypress run` rather than `cypress open`:

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

## Summary

- Cypress is a front-end-focused E2E testing framework that works out of the box and needs no WebDriver.
- Its automatic retry mechanism makes tests more stable, removing the need for manual `sleep` or `wait` calls.
- Prefer `data-testid` as your selector strategy to keep tests from breaking when styles change.
- Use fixtures to mock API data so tests don't depend on the back-end environment.
- Custom commands and the page object pattern keep test code organized and reduce duplication.
- In CI, use `cypress run` (headless) together with `wait-on` to make sure the app is ready before tests run.
- Set sensible timeouts and viewport sizes to fit different scenarios.
