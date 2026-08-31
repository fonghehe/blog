---
title: "Cypress E2Eテスト入門と実践"
date: 2019-08-09 09:44:05
tags:
  - テスト
readingTime: 5
description: "フロントエンドの自動化テストは、チームでの導入が常に難しい課題だった。ユニットテストではユーザーの実際の操作フローをカバーできず、Seleniumは設定が複雑で動作も不安定だ。Cypressは現代のフロントエンドアプリケーション向けに設計されたE2Eテストフレームワークで、すぐに使えてAPIもシンプル、自動リトライ機構も備わっており、現在コミュニティで非常に人気のある選択肢である。本記事ではゼロからCypressのテスト環境を構築し、コア機能を順を追って解説する。"
wordCount: 872
---

フロントエンドの自動化テストは、チームでの導入が常に難しい課題だった。ユニットテストではユーザーの実際の操作フローをカバーできず、Seleniumは設定が複雑で動作も不安定だ。Cypressは現代のフロントエンドアプリケーション向けに設計されたE2Eテストフレームワークで、すぐに使えてAPIもシンプル、自動リトライ機構も備わっており、現在コミュニティで非常に人気のある選択肢である。本記事ではゼロからCypressのテスト環境を構築し、コア機能を順を追って解説する。

## インストールと初期化

```bash
npm install --save-dev cypress
```

`package.json` にスクリプトを追加する：

```json
{
  "scripts": {
    "cypress:open": "cypress open",
    "cypress:run": "cypress run"
  }
}
```

初めて `npx cypress open` を実行すると、以下のディレクトリ構造が自動作成される：

```
cypress/
├── fixtures/       # テストデータ
├── integration/    # テストケース
├── plugins/        # プラグイン設定
└── support/        # ヘルパー関数とコマンド
```

## 最初のテストケース

`cypress/integration/home.spec.js` を作成する：

```js
describe('ホームページテスト', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('ページタイトルが正しくレンダリングされること', () => {
    cy.get('h1').should('contain', 'ようこそ');
  });

  it('ナビゲーションリンクをクリックできること', () => {
    cy.get('[data-testid="nav-about"]').click();
    cy.url().should('include', '/about');
  });

  it('コンテンツを検索できること', () => {
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

### 要素の選択

CypressはjQueryセレクタ構文を使用する。セレクタには `data-testid` を使うことを推奨する：

```js
// 推奨：data-testidを使用すれば、スタイルや構造の変更に影響されない
cy.get('[data-testid="submit-button"]')

// CSSセレクタも使用可能
cy.get('.btn-primary')
cy.get('#login-form')
cy.get('form > button[type="submit"]')

// テキストを含む要素の選択
cy.contains('送信')
cy.contains('button', 'ログイン')
```

### アサーション

CypressにはChaiアサーションライブラリが組み込まれており、BDDスタイルの `should` と `expect` をサポートしている：

```js
// 要素の存在確認
cy.get('.error-msg').should('exist');
cy.get('.loading').should('not.exist');

// テキストコンテンツ
cy.get('.title').should('contain', 'ようこそ');
cy.get('.title').should('have.text', '私のサイトへようこそ');

// 属性とクラス名
cy.get('input').should('have.value', 'test');
cy.get('.card').should('have.class', 'active');
cy.get('a').should('have.attr', 'href', '/about');

// 個数
cy.get('.list-item').should('have.length', 5);
cy.get('.card').should('have.length.greaterThan', 0);

// 表示状態
cy.get('.modal').should('be.visible');
cy.get('.hidden-element').should('not.be.visible');

// CSSスタイル
cy.get('.btn').should('have.css', 'color', 'rgb(0, 123, 255)');
```

### インタラクション操作

```js
// クリック
cy.get('.btn').click();
cy.get('.btn').dblclick();
cy.get('.btn').rightclick();

// 入力
cy.get('input').type('Hello World');
cy.get('input').clear().type('new value');

// フォーム
cy.get('select').select('オプション1');
cy.get('[type="checkbox"]').check();
cy.get('[type="checkbox"]').uncheck();
cy.get('[type="radio"]').check();

// スクロール
cy.get('.long-list').scrollTo('bottom');
cy.scrollTo(0, 500);
```

## 非同期操作の処理

Cypressの中核的な設計思想の一つは自動リトライであり、ほとんどのコマンドはアサーションが通るかタイムアウトするまで自動的にリトライする。

### ネットワークリクエスト

```js
// APIリクエストのインターセプト
describe('ユーザー一覧', () => {
  it('ユーザーデータを読み込んで表示すること', () => {
    // cy.serverとcy.routeでリクエストをインターセプト
    cy.server();
    cy.route('GET', '/api/users', 'fixture:users.json').as('getUsers');

    cy.visit('/users');

    // リクエスト完了を待機
    cy.wait('@getUsers');

    // ページレンダリングの検証
    cy.get('[data-testid="user-row"]').should('have.length', 10);
  });

  it('リクエスト失敗を処理すること', () => {
    cy.server();
    cy.route({
      method: 'GET',
      url: '/api/users',
      status: 500,
      response: { error: 'サーバーエラー' },
    }).as('getUsersError');

    cy.visit('/users');
    cy.wait('@getUsersError');

    cy.get('.error-message').should('contain', 'サーバーエラー');
  });
});
```

### fixturesを使ったデータのモック

`cypress/fixtures/users.json` を作成する：

```json
[
  { "id": 1, "name": "张三", "email": "zhangsan@example.com" },
  { "id": 2, "name": "李四", "email": "lisi@example.com" },
  { "id": 3, "name": "王五", "email": "wangwu@example.com" }
]
```

```js
it('fixtureデータが表示されること', () => {
  cy.server();
  cy.route('GET', '/api/users', 'fixture:users.json').as('getUsers');

  cy.visit('/users');
  cy.wait('@getUsers');

  cy.get('[data-testid="user-name"]').first().should('contain', '張三');
});
```

## カスタムコマンド

`cypress/support/commands.js` でカスタムコマンドを定義し、繰り返し操作をカプセル化する：

```js
// ログインコマンド
Cypress.Commands.add('login', (email = 'test@example.com', password = 'password123') => {
  cy.request({
    method: 'POST',
    url: '/api/login',
    body: { email, password },
  }).then((response) => {
    window.localStorage.setItem('token', response.body.token);
  });
});

// フォームの素早い入力
Cypress.Commands.add('fillForm', (formData) => {
  Object.entries(formData).forEach(([name, value]) => {
    cy.get(`[name="${name}"]`).clear().type(value);
  });
});

// 要素の表示待機
Cypress.Commands.add('waitForElement', (selector, timeout = 10000) => {
  cy.get(selector, { timeout }).should('be.visible');
});
```

カスタムコマンドの使用例：

```js
describe('ログインが必要なページ', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/dashboard');
  });

  it('ユーザー情報が表示されること', () => {
    cy.get('[data-testid="user-name"]').should('be.visible');
  });

  it('フォームを送信できること', () => {
    cy.fillForm({
      title: 'テストタイトル',
      content: 'テストコンテンツ',
    });
    cy.get('[data-testid="submit"]').click();
    cy.get('.success-message').should('contain', '送信成功');
  });
});
```

## ページオブジェクトパターン

テストケースが増えたら、ページオブジェクトパターンでコードを整理できる：

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
// テストケース
import LoginPage from '../pages/LoginPage';

describe('ログイン機能', () => {
  beforeEach(() => {
    LoginPage.visit();
  });

  it('ログイン成功後にホームページへ遷移すること', () => {
    LoginPage.login('admin@example.com', 'admin123');
    cy.url().should('include', '/dashboard');
  });

  it('間違ったパスワードでエラーメッセージが表示されること', () => {
    LoginPage.login('admin@example.com', 'wrong');
    LoginPage.getErrorMessage().should('contain', 'パスワードが間違っています');
  });
});
```

## 設定ファイル

`cypress.json` の一般的な設定：

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

CI環境では `cypress open` ではなく `cypress run` を使用する：

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

- Cypressはフロントエンド向けに設計されたE2Eテストフレームワークで、WebDriver不要ですぐに使える
- 自動リトライ機構によりテストが安定し、手動で `sleep` や `wait` を追加する必要がない
- セレクタには `data-testid` を推奨する。スタイル変更によるテスト失敗を防げる
- fixturesを使ってAPIデータをモックすることで、バックエンド環境に依存しないテストができる
- カスタムコマンドとページオブジェクトパターンでテストコードを効果的に整理し、重複を減らせる
- CI連携時は `cypress run`（ヘッドレスモード）を使い、`wait-on` でアプリの準備完了を待ってからテストを実行する
- タイムアウト時間とviewportサイズを適切に設定し、さまざまな場面に対応すること
