---
title: "フロントエンドテストピラミッドの再構築：ユニットから E2E までの戦略進化"
date: 2026-07-31 19:23:17
tags:
  - テスト
  - エンジニアリング
readingTime: 14
description: "伝統的なテストピラミッドモデルはフロントエンド領域にそぐわない。本記事は Testing Trophy モデルから出発し、フロントエンドテストの階層化戦略を再审视する：ユニットテストの境界、コンポーネントテストのクエリ哲学、ビジュアルリグレッション、コントラクトテスト、E2E コスト制御、CI での階層化実行戦略。"
wordCount: 3264
---

「テストピラミッド」——ベースに大量のユニットテスト、中間にインテグレーションテスト、頂上に少量の E2E テスト——このモデルは 2009 年の提唱以来ずっと不動の鉄則とされてきた。しかしフロントエンド領域では、このモデルをそのまま適用すると大量の低価値テストと脆弱な E2E スイートを生む。2026 年のフロントエンドテスト戦略は階層化ロジックを見直す必要がある。

## 伝統的テストピラミッドのフロントエンドにおける問題

古典的テストピラミッドの前提は：ユニットテストが最も安価で最速であり、大半を占めるべき、E2E テストが最も高コストで最も遅いため最小限にすべき、というものである。この前提はバックエンドサービスではほぼ成立する——関数の入出力が明確で、データベースを mock すれば純粋なユニットテストになる。

しかしフロントエンドの「ユニット」の定義は曖昧である。React コンポーネントの「ユニット」とは何か？コンポーネント関数自体か？それともレンダリングされた DOM か？それともユーザーインタラクションの完全なフローか？コンポーネントの内部実装詳細（state 変化、内部関数呼び出し）をユニットテストの対象にすると、テストは極めて脆弱になる——リファクタリングのたびにテストを変更する必要があり、テストは振る舞いではなく実装に縛られる。

より深い問題は：フロントエンドの価値はユーザーインタラクション体験にあり、体験はコンポーネントの組み合わせから生まれるということである。Button コンポーネントの onClick トリガーを単独でテストしても、ほとんど情報量がない——本当にバグが出る場所は Form 内の Button の送信フロー、Modal 内の Button のクローズ動作、非同期ロード中の Button の無効状態である。これらは純粋なユニットテストではカバーできない。

## Testing Trophy：2026 年のフロントエンドテスト階層化

Kent C. Dodds が提唱した Testing Trophy モデルはフロントエンドの実情により合致する。下から上への階層は以下の通り：

- **静的チェック**（ESLint + TypeScript）：ゼロコストで大量の型・構文エラーをキャッチ
- **ユニットテスト**：純粋関数とユーティリティロジックをテスト
- **インテグレーションテスト**（最大割合）：コンポーネントの組み合わせ、インタラクションフローをテスト
- **E2E テスト**：少量の主要パスのエンドツーエンド検証

重要な変化はインテグレーションテストが主力になることである。フロントエンドのテスト価値の大半は「コンポーネントが真実の環境でどうインタラクションするか」から来ており、孤立した関数呼び出しではない。

## ユニットテストの境界：何をテストすべきか、すべきでないか

ユニットテストに適するのは**純粋関数**である——入力が出力を決定し、副作用がなく、外部状態に依存しない。フロントエンドの純粋関数は主に以下：

- ユーティリティ関数（フォーマット、計算、バリデーション）
- 状態セレクタ（store からの派生データ）
- 業務ロジック関数（価格計算、権限判定）
- reducer / 状態変換関数

```typescript
// utils/price.ts - 純粋関数、ユニットテストに適する
export function calculateDiscountedPrice(
  price: number,
  discount: { type: 'percentage' | 'fixed'; value: number },
  quantity: number = 1,
): number {
  const subtotal = price * quantity;
  if (discount.type === 'percentage') {
    return Math.round(subtotal * (1 - discount.value / 100) * 100) / 100;
  }
  return Math.max(0, subtotal - discount.value * quantity);
}

// price.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscountedPrice } from './price';

describe('calculateDiscountedPrice', () => {
  it('パーセンテージ割引が正しく計算される', () => {
    expect(calculateDiscountedPrice(100, { type: 'percentage', value: 20 }))
      .toBe(80);
  });

  it('固定割引は 0 を下回らない', () => {
    expect(calculateDiscountedPrice(10, { type: 'fixed', value: 50 }))
      .toBe(0);
  });

  it('バッチ購入で割引が正しく適用される', () => {
    expect(calculateDiscountedPrice(50, { type: 'percentage', value: 10 }, 3))
      .toBe(135);
  });
});
```

**ユニットテストすべきでないもの**：コンポーネントの内部状態マシン、レンダリング出力、イベント処理。これらはインテグレーションテストに任せるべきである。判断基準はシンプル——コンポーネントの実装をリファクタリングして（振る舞いを変えずに）テストが失敗する場合、そのテストは振る舞いではなく実装詳細をテストしている。

## コンポーネントテスト：Testing Library のクエリ哲学

Testing Library の中核理念は「ユーザーが知覚できる方法で DOM をクエリする」ことである——コンポーネントインスタンスメソッドや内部 state ではなく、ロール（role）、テキスト内容、ラベル関連などのユーザー視点のクエリ方式を使用する。

```typescript
// LoginForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('有効な認証情報を送信後に onSubmit が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);

    // role + name でクエリ、ユーザー視点をシミュレート
    await user.type(screen.getByRole('textbox', { name: /メール/i }), 'user@test.com');
    await user.type(screen.getByLabelText(/パスワード/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ログイン/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });

  it('空フィールドでバリデーションエラーを表示', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /ログイン/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('メールアドレスを入力してください');
  });

  it('送信中はボタンを無効化', async () => {
    const user = userEvent.setup();
    // 遅いレスポンスをシミュレート
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));

    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByRole('textbox', { name: /メール/i }), 'user@test.com');
    await user.type(screen.getByLabelText(/パスワード/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ログイン/i }));

    expect(screen.getByRole('button', { name: /送信中/i })).toBeDisabled();

    resolveSubmit!();
    // ボタンの復帰を待つ
    await screen.findByRole('button', { name: /ログイン/i });
  });
});
```

クエリの優先順位は Testing Library の最も価値のある設計決定である：`getByRole` > `getByLabelText` > `getByText` > `getByTestId`。セマンティッククエリを優先することで、テストがより堅牢になるだけでなく、コンポーネントのアクセシビリティを逆に促進できる——テストで `role` が見つからなければ、コンポーネントに ARIA 属性が欠けていることを意味し、それ自体がアクセシビリティの欠陥である。

## ビジュアルリグレッションテスト：Storybook + Chromatic

機能テストはインタラクション振る舞いを検証するが、ビジュアルのリグレッションをキャッチできない——CSS 変更によるスペーシングのズレ、フォントフォールバック、色コントラストの変化。ビジュアルリグレッションテストはスクリーンショット比較でこの空白を埋める。

```typescript
// stories/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: { viewports: [320, 768, 1200] },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'クリック' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: 'クリック', disabled: true },
};

// インタラクションテストも Storybook で実行可能
export const FormSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText('送信済み')).toBeVisible();
  },
};
```

Chromatic の利点は、コンポーネントレベルのビジュアル差分を理解していることである——ブラウザのアンチエイリアスの微小な差分で誤検出せず、知覚的差分（perceptual difference）に基づいて判定する。チームは閾値戦略を設定する必要がある：0.1% 未満の差分は自動承認、超える場合は人間がレビューする。

## コントラクトテスト：フロントエンドとバックエンドの協業の保障

フロントエンド・バックエンド分離アーキテクチャで、頻発するバグは：バックエンドが API レスポンス構造を変更し、フロントエンドが同期更新せず、ユーザーからの報告まで気づかないことである。コントラクトテストはフロントエンドとバックエンドで共有の API 契約定義によりこれを防ぐ。

Pact は最も成熟したコントラクトテストフレームワークだが、コンシューマ駆動契約（CDC）の完全なフローはやや重い。2026 年のより軽量な手法は OpenAPI Schema でコントラクト検証を行うことである：

```typescript
// tests/contract/user-api.contract.test.ts
import { describe, it, expect } from 'vitest';
import { openapiSchema } from '../schemas/user-api.schema';
import { fetchUser } from '@/api/user';

describe('User API 契約', () => {
  it('GET /users/:id レスポンスが schema に合致', async () => {
    const response = await fetchUser('123');

    // OpenAPI schema でレスポンス構造を検証
    const validator = new OpenAPIValidator(openapiSchema);
    const result = validator.validateResponse('/users/{id}', 'get', 200, response);

    expect(result.valid).toBe(true);
  });

  it('フロントエンドの型定義が API schema と一致', () => {
    // コンパイル時保証：フロントエンドの User 型は schema から生成
    // schema が変われば生成される型も変わり、コンパイルエラーになる
    const user: User = {
      id: '123',
      email: 'test@example.com',
      profile: { name: 'Test', avatar: null },
    };
    expect(user).toBeDefined();
  });
});
```

より理想的なワークフローは：バックエンドが OpenAPI Schema ファイルをメンテナンスし、フロントエンドは `openapi-typescript` で TypeScript 型を生成し、CI で schema と実際の API レスポンスの一貫性を検証する。これにより契約変更がコンパイル時にフロントエンドで感知される。

## E2E テストのコスト制御：Playwright の並列化と選択的実行

E2E テストは価値が最も高いがコストも最も高い——実行が遅く、環境依存が多く、flaky になりやすい。コスト制御の鍵は**選択的実行**である：

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 2 : 0,

  // CI でのみ全ブラウザを実行、ローカルは chromium のみ
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      metadata: { tier: 'smoke' },
    },
    ...(process.env.CI
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],

  // テスト階層のアノテーション
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

`@tier` アノテーションで E2E テストを階層化する：

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

// スモークテスト：PR のたびに実行、主要パスをカバー
test.describe('Checkout スモークテスト @tier:smoke', () => {
  test('完全な購入フローを完了', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'カートに追加' }).first().click();
    await page.getByRole('link', { name: 'カート' }).click();
    await page.getByRole('button', { name: 'チェックアウト' }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await page.getByRole('button', { name: '注文確認' }).click();
    await expect(page.getByText('注文が作成されました')).toBeVisible();
  });
});

// 全量回帰：main へのマージ時のみ実行
test.describe('Checkout エッジケース @tier:full', () => {
  test('在庫不足時に注文をブロック', async ({ page }) => {
    // API で在庫 0 の状態をシミュレート
    await page.route('**/api/inventory/*', (route) =>
      route.fulfill({ json: { stock: 0 } }),
    );
    await page.goto('/product/123');
    await expect(page.getByText('在庫切れ')).toBeVisible();
    await expect(page.getByRole('button', { name: 'カートに追加' })).toBeDisabled();
  });
});
```

CI で階層ごとにトリガー：

```yaml
# .github/workflows/test.yml
jobs:
  pr-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ユニット + インテグレーションテスト
        run: pnpm test:unit
      - name: E2E スモークテスト
        run: pnpm test:e2e --grep @tier:smoke

  full-regression:
    if: github.base_ref == 'main'
    runs-on: ubuntu-latest
    steps:
      - name: E2E 全量回帰
        run: pnpm test:e2e
```

## テストカバレッジの罠：100% を追求しない

カバレッジはボトムライン指標であり、目標ではない。100% カバレッジはバグがないことを意味しない——100% 行カバレッジの関数でも、境界条件テストが欠けている可能性がある。より危険なのは、カバレッジを稼ぐために書かれたテストは往々にして低価値であることである。

現実的なやり方は合理的なカバレッジ閾値（行カバレッジ 70-80%、分岐カバレッジ 60-70%）を設定し、高リスク領域に注力することである：金融計算、権限ロジック、状態変換。カバレッジの絶対値よりも変化傾向の方が意味がある——ある PR でカバレッジが 5% 低下した場合、テストの欠落がないかレビューする価値がある。

## 完全なテスト階層化プラクティス

典型的なフロントエンドプロジェクトのテスト設定：

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e', '.storybook'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 75,
        branches: 65,
        exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
      },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

```typescript
// tests/setup.ts - グローバルテスト設定
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// MSW が全テストで API リクエストをインターセプト
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

MSW（Mock Service Worker）はフロントエンドテストにおける API mock の最適な選択である。アプリケーションコードを侵襲せず（fetch/axios 層への mock 注入が不要）、Service Worker 層でネットワークリクエストをインターセプトする。同じ mock handler をインテグレーションテストと Storybook で共有できる。

## CI でのテスト戦略：PR チェック vs 全量回帰

CI テスト戦略の中核は**階層化実行、オンデマンドトリガー**である：

- **PR 提出時**：ESLint + TypeScript チェック → ユニット + インテグレーションテスト → E2E スモークテスト。目標は 5 分以内にフィードバックを返すこと。
- **main へのマージ時**：全量 E2E 回帰 + ビジュアルリグレッションテスト + クロスブラウザテスト。15-20 分の実行時間は許容される。
- **定期タスク**：毎日早朝に全量回帰を一回実行し、依存更新による暗黙の破壊をキャッチする。

PR チェック段階が 10 分を超えると、開発者はテストをスキップし始めるか手動でマージするようになる。PR チェックを高速に保つことはテスト戦略が定着する前提である——E2E スモークケース数を減らしても、CI を開発効率のボトルネックにしてはならない。

## まとめ

フロントエンドのテスト戦略は盲目的に古典的ピラミッドモデルを適用すべきではない。Testing Trophy モデルはフロントエンドの実情により合致する：静的チェックを基盤とし、純粋関数をユニットテストし、コンポーネントインタラクションをインテグレーションテスト（主力）とし、主要パスを E2E とする。中核原則は振る舞いを実装詳細ではなくテストすること、ユーザー視点で DOM をクエリすること、リスクに応じてテスト投資を配分すること、CI で階層化実行してフィードバック速度を制御することである。カバレッジは参考であって目標ではない——良いテスト戦略はリファクタリング時に自信を与え、バグ発生時に迅速な特定を可能にするものであり、完璧なパーセンテージの数字を追うものではない。
