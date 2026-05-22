---
title: "フロントエンドテスト戦略：完璧より実用を"
date: 2025-09-08 15:22:59
tags:
  - フロントエンド
readingTime: 3
description: "テストは誰もが重要だと分かっていながら、実際にはほとんどのチームがうまくできていないことです。ここ数年でフロントエンドテスト戦略についての認識がどう変わったかを共有します。"
wordCount: 526
---

テストは誰もが重要だと分かっていながら、実際にはほとんどのチームがうまくできていないことです。ここ数年でフロントエンドテスト戦略についての認識がどう変わったかを共有します。

## テストピラミッド → テストトロフィー

古典的なテストピラミッドは「ユニットテスト最多、統合テスト中、E2E最少」と言います。

でも Kent C. Dodds が提唱するテストトロフィー（Testing Trophy）の方がフロントエンドに適しています：

```
            /\
           /E2E\        少（重要なフロー）
          /------\
         /Integration\  中（機能モジュール）
        /------------\
       /  Unit Tests  \  適量（純粋関数、ユーティリティ）
      /----------------\
     /   Static Types   \  最多（TypeScript）
    /--------------------\
```

**最も重要なのは統合テスト**です。ユーザーの実際の体験を最もよく反映しながら、E2Eより高速だからです。

## ツール選択（2025年）

```
ユニット/統合：Vitest（高速、ネイティブESM、Viiteエコシステム）
コンポーネント：@testing-library/react または @testing-library/vue
E2E：          Playwright（Cypressよりモダン）
カバレッジ：    @vitest/coverage-v8
```

## 何をテストし、何をテストしないか

```
✅ テストすべきもの：
  - ビジネスロジック（ユーザーがフローを完了できるか）
  - エッジケース（空データ、エラー状態）
  - 純粋関数とユーティリティ関数
  - API統合（MSW mock）

❌ テスト不要なもの：
  - サードパーティライブラリの動作
  - 実装の詳細（内部状態、プライベートメソッド）
  - スタイル（ビジュアルリグレッションテスト以外）
  - 単純なgetter/setter
```

## 実際のテスト例

```tsx
// 実装の詳細ではなく、ユーザーフローをテスト
import { render, screen, userEvent } from "@testing-library/react";
import { AddToCart } from "./AddToCart";

describe("AddToCart", () => {
  it("カートに追加ボタンをクリックすると数量が増え、成功メッセージが表示される", async () => {
    const user = userEvent.setup();
    const mockAddToCart = vi.fn().mockResolvedValue({ success: true });

    render(<AddToCart productId="123" onAddToCart={mockAddToCart} />);

    // ユーザー操作をシミュレート
    await user.click(screen.getByRole("button", { name: /カートに追加/ }));

    // 結果を検証（実装の詳細ではなく）
    expect(mockAddToCart).toHaveBeenCalledWith("123", 1);
    expect(await screen.findByText("カートに追加しました")).toBeInTheDocument();
  });

  it("在庫切れの場合、ボタンが無効化される", () => {
    render(<AddToCart productId="123" inStock={false} />);

    const button = screen.getByRole("button", { name: /カートに追加/ });
    expect(button).toBeDisabled();
  });
});
```

```typescript
// MSW：APIリクエストをモック
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/products/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "テスト商品",
      price: 99,
      inStock: true,
    });
  }),

  http.post("/api/cart", () => {
    return HttpResponse.json({ success: true, cartCount: 1 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Playwright E2E

```typescript
// tests/checkout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("購入フロー", () => {
  test("ユーザーが完全な購入フローを完了できる", async ({ page }) => {
    await page.goto("/products/123");

    await expect(page.getByRole("heading")).toContainText("商品名");

    await page.getByRole("button", { name: "カートに追加" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/cart");
    await page.getByRole("button", { name: "レジへ進む" }).click();

    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="address"]', "テスト住所");

    await page.getByRole("button", { name: "注文を確定する" }).click();
    await expect(page.getByText("注文が完了しました")).toBeVisible();
  });
});
```

## CI統合

```yaml
# .github/workflows/test.yml
- name: テスト実行
  run: |
    pnpm test:unit --coverage
    pnpm test:e2e

- name: カバレッジ閾値チェック
  run: |
    # カバレッジ未達→CI失敗
    pnpm test:coverage --reporter=json
    node scripts/check-coverage.js 70  # 70%閾値
```

## テスト文化

技術より難しいのは、チームがテストを日常業務として取り組むようにすることです：

- **テストはコードの一部であり、付加作業ではない**
- コードレビュー時にテストも確認する
- バグを修正する前に失敗するテストを書き、それからバグを修正する
- 100%カバレッジを追わず、意味のあるテストを追う

## まとめ

- テストトロフィー：統合テスト > ユニットテスト > E2E
- テストすること：ユーザーフロー、ビジネスロジック、エッジケース
- テストしないこと：実装の詳細、サードパーティライブラリ、シンプルなスタイル
- ツール：Vitest + @testing-library + MSW + Playwright
- カバレッジは手段であり目標ではない；70%の意味あるカバレッジは95%の数字より価値がある
