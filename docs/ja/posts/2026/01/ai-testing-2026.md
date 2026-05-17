---
title: "AIテスト 2026：完全自動化"
date: 2026-01-14 10:00:00
tags:
  - エンジニアリング
readingTime: 3
description: "テストケースを書くことは、フロントエンド開発において最も退屈でありながら最も重要な作業の一つです。2026年、AIは単体テスト、統合テスト、エンドツーエンドテストを自動生成できるようになりました。しかし「自動生成」は「良いテストを自動生成」と同じではありません——ひどいテストはテストがないよりも危険です。偽の安全感を与"
---

テストケースを書くことは、フロントエンド開発において最も退屈でありながら最も重要な作業の一つです。2026年、AIは単体テスト、統合テスト、エンドツーエンドテストを自動生成できるようになりました。しかし「自動生成」は「良いテストを自動生成」と同じではありません——ひどいテストはテストがないよりも危険です。偽の安全感を与えるからです。

## テスト生成の正しいアプローチ

AIに「このコンポーネントのテストを書いて」と直接頼むと、通常は役に立たないコードが出てきます。良いテスト生成には文脈の提供が必要です：実際のユーザー操作パス、境界条件、「このコンポーネントがバグを起こしやすい箇所」です。

```tsx
// テスト対象コンポーネント —— 典型的なフォームコンポーネント
interface AddressFormProps {
  onSubmit: (data: AddressData) => Promise<void>;
  initialValues?: Partial<AddressData>;
  disabled?: boolean;
}

export function AddressForm({
  onSubmit,
  initialValues,
  disabled,
}: AddressFormProps) {
  const [province, setProvince] = useState(initialValues?.province ?? "");
  const [city, setCity] = useState(initialValues?.city ?? "");
  const [district, setDistrict] = useState(initialValues?.district ?? "");
  const [detail, setDetail] = useState(initialValues?.detail ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ... フォームロジック
}

// AIにテスト生成を依頼する際に注入すべきプロンプト：
// "このコンポーネントの主なリスクポイント：
//  1. 都道府県・市区町村の三段階連動：都道府県を選ぶと市区町村リストがリセットされ選び直しが必要
//  2. 送信時の重複送信防止
//  3. initialValuesが変わるとフォームを再初期化する必要あり
//  4. disabled状態ではすべての入力とボタンが操作不可"
```

```tsx
// AI生成のテスト —— リスクポイントに基づいたターゲット型テスト
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressForm } from "./address-form";

describe("AddressForm", () => {
  it("都道府県切り替え時に市区町村の選択をクリアすること", async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("都道府県"), "東京都");
    await user.selectOptions(screen.getByLabelText("市区町村"), "新宿区");

    // 都道府県を切り替える
    await user.selectOptions(screen.getByLabelText("都道府県"), "大阪府");

    expect(screen.getByLabelText("市区町村")).toHaveValue("");
    expect(screen.getByLabelText("区域")).toHaveValue("");
  });

  it("送信中は重複送信を防ぐこと", async () => {
    const user = userEvent.setup();
    const slowSubmit = vi.fn(() => new Promise((r) => setTimeout(r, 2000)));
    render(<AddressForm onSubmit={slowSubmit} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "送信" }));

    // 送信ボタンはすぐに無効化されること
    expect(screen.getByRole("button", { name: "送信中..." })).toBeDisabled();

    // 再クリックしても二回目の送信がトリガーされないこと
    await user.click(screen.getByRole("button", { name: "送信中..." }));
    expect(slowSubmit).toHaveBeenCalledTimes(1);
  });

  it("initialValuesが変わるとフォームを再初期化すること", async () => {
    const { rerender } = render(
      <AddressForm onSubmit={vi.fn()} initialValues={{ province: "東京都" }} />,
    );
    expect(screen.getByLabelText("都道府県")).toHaveValue("東京都");

    rerender(
      <AddressForm onSubmit={vi.fn()} initialValues={{ province: "大阪府" }} />,
    );
    expect(screen.getByLabelText("都道府県")).toHaveValue("大阪府");
  });
});
```

## E2EテストのためのAI生成戦略

エンドツーエンドテストは最も自動生成が難しいものです。AIはユーザージャーニーを理解し、非同期操作を待ち、動的コンテンツを扱う必要があります。重要なのは、AIを自由に動かすのではなく、プロンプトでユーザー操作のシーケンスを明確に説明することです。

```typescript
// e2e-test-prompt.ts —— AIへのE2EテストプロンプトテンプレートConst e2eTestPrompt = `
const e2eTestPrompt = `
以下のユーザージャーニーに対するPlaywright E2Eテストを生成してください：

ジャーニー：ユーザー登録 -> 商品閲覧 -> カートに追加 -> 精算

主要なアサーションポイント：
1. 登録成功後にホームページへリダイレクトし、右上にユーザー名が表示される
2. 商品リスト読み込み完了後、少なくとも12件の商品カードが表示される
3. カートに追加後、下部のカートバッジの数字が+1される
4. 精算ページに表示される商品数と価格がカートと一致する

技術的詳細：
- APIはモック（msw）を使用、バックエンドに依存しない
- page.waitForResponseでデータ読み込みを待機する
- 要素特定にはdata-testidを使用する
`;

// AI生成のE2Eテスト
import { test, expect } from "@playwright/test";

test("完全な購入フロー", async ({ page }) => {
  // 1. 登録
  await page.goto("/register");
  await page.getByTestId("email-input").fill("test@example.com");
  await page.getByTestId("password-input").fill("SecurePass123!");
  await page.getByTestId("name-input").fill("テストユーザー");

  const registerResponse = page.waitForResponse("/api/auth/register");
  await page.getByTestId("register-btn").click();
  await registerResponse;

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("user-name")).toHaveText("テストユーザー");

  // 2. 商品閲覧
  await page.goto("/products");
  await page.waitForResponse("/api/products*");

  const productCards = page.getByTestId("product-card");
  await expect(productCards).toHaveCount(12);

  // 3. カートに追加
  const cartBadge = page.getByTestId("cart-badge");
  const initialCount = parseInt((await cartBadge.textContent()) ?? "0");

  await productCards.first().getByTestId("add-to-cart").click();
  await expect(cartBadge).toHaveText(String(initialCount + 1));

  // 4. 精算
  await page.getByTestId("cart-icon").click();
  await page.getByTestId("checkout-btn").click();

  const checkoutItems = page.getByTestId("checkout-item");
  await expect(checkoutItems).toHaveCount(1);
});
```

## テストカバレッジのAI分析

カバレッジの数値自体にはあまり意味がありません。AIの価値は、カバーされていないコードパスのうち本当にリスクの高いものを分析し、優先順位付けを助けることです。

```typescript
// coverage-analysis.ts
interface CoverageGap {
  file: string;
  line: number;
  branch: string;
  riskScore: number; // AIが評価したリスクスコア 0-100
  reason: string;
  suggestedTest: string;
}

// AI分析後の出力例
const gaps: CoverageGap[] = [
  {
    file: "src/utils/payment.ts",
    line: 45,
    branch: "payment-retry-on-timeout",
    riskScore: 95,
    reason: "支払いリトライロジック、タイムアウトシナリオが未テスト",
    suggestedTest:
      "3回リトライ後も失敗した場合のフォールバック処理をテストすべき",
  },
  {
    file: "src/components/modal.tsx",
    line: 22,
    branch: "escape-key-handler",
    riskScore: 15,
    reason: "ESCでモーダルを閉じる、標準的な動作",
    suggestedTest: "任意、優先度低",
  },
  {
    file: "src/hooks/useWebSocket.ts",
    line: 78,
    branch: "reconnect-after-network-change",
    riskScore: 88,
    reason:
      "ネットワーク切り替え時の再接続ロジック、タイマーと状態クリーンアップを伴う",
    suggestedTest:
      "ネットワーク切断→復元をシミュレートし、再接続とメッセージ再送を確認すべき",
  },
];

// リスクスコアでソートし、高リスクの未カバーパスのみに集中する
const highRiskGaps = gaps.filter((g) => g.riskScore >= 70);
```
