---
title: "Cypress E2Eテスト入門と実践"
date: 2019-08-09 09:44:05
tags:
  - テスト
readingTime: 4
description: "前端自动化测试一直是团队落地的难点。单元测试覆盖不到用户真实操作流程，Selenium 又配置复杂、运行不稳定。Cypress 是一个专门为现代前端应用设计的 E2E 测试框架，开箱即用、API 简洁、自带自动重试机制，是目前社区中非常受欢迎的选择。本文将从零搭建 Cypress 测试环境，逐步覆盖核心功能。"
wordCount: 547
---

前端自动化测试一直是团队落地的难点。单元测试覆盖不到用户真实操作流程，Selenium 又配置复杂、运行不稳定。Cypress 是一个专门为现代前端应用设计的 E2E 测试框架，开箱即用、API 简洁、自带自动重试机制，是目前社区中非常受欢迎的选择。本文将从零搭建 Cypress 测试环境，逐步覆盖核心功能。

## インストールと初期化

```bash
npm install --save-dev cypress
```

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "cypress:open": "cypress open",
    "cypress:run": "cypress run"
  }
}
```

首次运行 `npx cypress open` 会自动创建以下目录结构：

```
cypress/
├── fixtures/       # 测试数据
├── integration/    # 测试用例
├── plugins/        # 插件配置
└── support/        # 辅助函数和命令
```

## 最初のテストケース

创建 `cypress/integration/home.spec.js`：

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

## コアAPIリファレンス

### 元素选择

Cypress 使用 jQuery 选择器语法，推荐使用 `data-testid` 作为选择器：

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

### 断言

Cypress 内置了 Chai 断言库，支持 BDD 风格的 `should` 和 `expect`：

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

### 交互操作

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

## 非同期操作の処理

Cypress 的核心设计理念之一是自动重试，大多数命令都会自动重试直到断言通过或超时。

### 网络请求

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

### 使用 fixtures 模拟数据

创建 `cypress/fixtures/users.json`：

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

## カスタムコマンド

在 `cypress/support/commands.js` 中定义自定义命令，封装重复操作：

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

使用自定义命令：

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

## ページオブジェクトパターン

当测试用例增多时，可以使用页面对象模式组织代码：

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

## 設定ファイル

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

## CI/CDへの統合

在 CI 环境中使用 `cypress run` 而非 `cypress open`：

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

## まとめ

- Cypress 是一个专为前端设计的 E2E 测试框架，开箱即用，无需 WebDriver
- 自动重试机制让测试更稳定，不需要手动添加 `sleep` 或 `wait`
- 推荐使用 `data-testid` 作为选择器，避免测试因样式变化而失败
- 使用 fixtures 模拟 API 数据，让测试不依赖后端环境
- 自定义命令和页面对象模式可以有效组织测试代码，减少重复
- CI 集成时使用 `cypress run`（无头模式），配合 `wait-on` 确保应用就绪后再执行测试
- 注意合理设置超时时间和 viewport 大小，适应不同场景
