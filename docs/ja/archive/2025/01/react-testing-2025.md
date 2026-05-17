---
title: "React テスト 2025：Vitest + Testing Library + Playwright + MSW 実践ガイド"
date: 2025-01-28 10:00:00
tags:
  - React
readingTime: 3
description: "2025年のReactテストエコシステムは、Vitestの台頭によってJestからの移行が加速しています。本記事では**Vitest**（ユニット/コンポーネントテスト）、**Testing Library**（DOMインタラクション）、**Playwright**（E2E）、**MSW**（APIモック）の4ツールを"
---

2025年のReactテストエコシステムは、Vitestの台頭によってJestからの移行が加速しています。本記事では**Vitest**（ユニット/コンポーネントテスト）、**Testing Library**（DOMインタラクション）、**Playwright**（E2E）、**MSW**（APIモック）の4ツールを組み合わせた実践的なテスト戦略を紹介します。

## テスト戦略の全体像

```
テストピラミッド（2025年推奨）：

E2E テスト（Playwright）         ←少数・重要なユーザーフロー
────────────────────────────────
統合テスト（Vitest + RTL + MSW）  ←コンポーネント + API の組み合わせ
────────────────────────────────
ユニットテスト（Vitest）          ←ビジネスロジック、ユーティリティ
```

## Vitest：Viteネイティブのテストフレームワーク

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler"]] } })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.stories.*", "src/test/**"],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
    // スナップショットの設定
    snapshotOptions: {
      snapshotFormat: { printBasicPrototype: false },
    },
  },
});
```

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll } from "vitest";
import { server } from "./msw-server"; // MSW サーバー

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

## React Testing Library：ユーザー視点のテスト

```typescript
// src/components/LoginForm.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  const setup = () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);
    return { user, onSuccess };
  };

  it("バリデーションエラーを表示する", async () => {
    const { user } = setup();

    // 空のフォームを送信
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(screen.getByText("メールアドレスは必須です")).toBeInTheDocument();
    expect(screen.getByText("パスワードは必須です")).toBeInTheDocument();
  });

  it("正しい認証情報でログインできる", async () => {
    const { user, onSuccess } = setup();

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ userId: "123", email: "user@example.com" });
    });
  });

  it("ログイン失敗時にエラーメッセージを表示する", async () => {
    const { user } = setup();
    // MSW でエラーレスポンスを返す（setup.ts でモックサーバーを起動済み）
    // 個別テストでハンドラーを上書きする
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ error: "認証情報が正しくありません" }, { status: 401 })
      )
    );

    await user.type(screen.getByLabelText("メールアドレス"), "wrong@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("認証情報が正しくありません");
    });
  });
});
```

## MSW：APIモックの標準化

```typescript
// src/test/msw-handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  // 認証
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === "user@example.com" && body.password === "password123") {
      return HttpResponse.json({ userId: "123", email: body.email });
    }
    return HttpResponse.json(
      { error: "認証情報が正しくありません" },
      { status: 401 },
    );
  }),

  // ユーザー一覧
  http.get("/api/users", () => {
    return HttpResponse.json({
      users: [
        { id: "1", name: "Alice", email: "alice@example.com" },
        { id: "2", name: "Bob", email: "bob@example.com" },
      ],
    });
  }),
];

// src/test/msw-server.ts
import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

export const server = setupServer(...handlers);
```

## Playwright：E2Eテスト

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["line"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

```typescript
// e2e/checkout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("チェックアウトフロー", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // テスト用のログイン状態を設定
    await page.evaluate(() => {
      localStorage.setItem("auth-token", "test-token");
    });
  });

  test("商品をカートに追加して購入できる", async ({ page }) => {
    // 商品一覧ページ
    await page.goto("/products");
    await page
      .getByRole("button", { name: "カートに追加", exact: false })
      .first()
      .click();

    // カートページ
    await page.goto("/cart");
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
    await page.getByRole("button", { name: "チェックアウトへ進む" }).click();

    // 注文確認
    await expect(page).toHaveURL(/\/checkout/);
    await page.getByLabel("カード番号").fill("4111111111111111");
    await page.getByRole("button", { name: "注文を確定する" }).click();

    await expect(page).toHaveURL(/\/orders\/\w+/);
    await expect(
      page.getByRole("heading", { name: "ご注文ありがとうございます" }),
    ).toBeVisible();
  });
});
```

## まとめ

2025年のReactテストの黄金律は **Vitest + Testing Library + MSW + Playwright** の組み合わせです。Vitestの高速な実行、Testing LibraryのアクセシビリティファーストなAPI、MSWによるリアルなAPIモック、PlaywrightのクロスブラウザE2Eテストをセットで導入することで、信頼性の高いテストスイートを効率よく構築できます。
