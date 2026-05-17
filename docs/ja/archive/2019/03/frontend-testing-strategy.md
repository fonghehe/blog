---
title: "フロントエンドテスト戦略：ユニットテストからE2Eテストまで"
date: 2019-03-22 09:33:00
tags:
  - テスト
readingTime: 1
description: "テストが重要なのはずっと分かっていたが、実際にテストを書くプロジェクトは少ない。今回しっかりと研究して、実用的なフロントエンドテスト戦略をまとめた。"
---

テストが重要なのはずっと分かっていたが、実際にテストを書くプロジェクトは少ない。今回しっかりと研究して、実用的なフロントエンドテスト戦略をまとめた。

## テストピラミッド

```
         /\
        /E2E\        少量：エンドツーエンドテスト（Cypress）
       /------\
      /統合テスト\   中量：コンポーネント統合テスト
     /----------\
    /ユニットテスト\ 大量：純粋関数、ユーティリティ関数テスト
   /______________\
```

すべてのコードをテストする必要はない——テストコストと価値のバランスを取ること。

## ユニットテスト：Jest

```bash
npm i -D jest @types/jest babel-jest
```

```javascript
// utils/price.js
export function formatPrice(price, currency = "JPY") {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
  }).format(price);
}

export function calculateDiscount(original, discount) {
  if (discount < 0 || discount > 1)
    throw new Error("割引率は0から1の間でなければなりません");
  return Math.round(original * discount * 100) / 100;
}
```

```javascript
// utils/price.test.js
import { formatPrice, calculateDiscount } from "./price";

describe("formatPrice", () => {
  it("円の価格をフォーマットすること", () => {
    expect(formatPrice(1234)).toBe("￥1,234");
  });

  it("ドルの価格をフォーマットすること", () => {
    expect(formatPrice(99.99, "USD")).toBe("US$99.99");
  });
});

describe("calculateDiscount", () => {
  it("8割引の価格を計算すること", () => {
    expect(calculateDiscount(100, 0.8)).toBe(80);
  });

  it("割引率が範囲外の時にエラーを投げること", () => {
    expect(() => calculateDiscount(100, 1.5)).toThrow(
      "割引率は0から1の間でなければなりません",
    );
    expect(() => calculateDiscount(100, -0.1)).toThrow();
  });

  it("浮動小数点の精度を処理すること", () => {
    expect(calculateDiscount(99.99, 0.7)).toBe(69.99);
  });
});
```

## Vueコンポーネントテスト：Vue Test Utils

```bash
npm i -D @vue/test-utils vue-jest
```

```javascript
// components/BaseButton.test.js
import { shallowMount } from "@vue/test-utils";
import BaseButton from "./BaseButton.vue";

describe("BaseButton", () => {
  it("スロットのコンテンツをレンダリングすること", () => {
    const wrapper = shallowMount(BaseButton, {
      slots: { default: "クリック" },
    });
    expect(wrapper.text()).toBe("クリック");
  });

  it("クリック時にclickイベントを発火すること", async () => {
    const wrapper = shallowMount(BaseButton);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("disabledの時はイベントを発火しないこと", async () => {
```
