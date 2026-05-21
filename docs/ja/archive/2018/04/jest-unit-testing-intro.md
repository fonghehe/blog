---
title: "Jest ユニットテスト入門"
date: 2018-04-02 10:27:58
tags:
  - テスト
readingTime: 3
description: "フロントエンドテストは長らく軽視されてきた分野ですが、プロジェクトの規模が大きくなるにつれ、テストのないコードは維持が困難になっていきます。Jest は現在最も人気のある JavaScript テストフレームワークで、設定が簡単で機能も充実しています。"
wordCount: 407
---

フロントエンドテストは長らく軽視されてきた分野ですが、プロジェクトの規模が大きくなるにつれ、テストのないコードは維持が困難になっていきます。Jest は現在最も人気のある JavaScript テストフレームワークで、設定が簡単で機能も充実しています。

## インストールと設定

```bash
npm install --save-dev jest babel-jest @babel/preset-env

# Vue プロジェクトにはさらに必要
npm install --save-dev @vue/test-utils vue-jest
```

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ["js", "vue", "json"],
  transform: {
    "^.+\\.vue$": "vue-jest",
    "^.+\\.js$": "babel-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // パスエイリアス
  },
  testMatch: ["**/__tests__/**/*.spec.js"],
};
```

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## 基本構文

```javascript
// __tests__/utils.spec.js

// describe でテストをグループ化
describe("formatPrice", () => {
  // it/test で個別のテストケース
  it("整数金額を正しくフォーマットする", () => {
    expect(formatPrice(1000)).toBe("1,000.00");
  });

  it("小数金額を正しくフォーマットする", () => {
    expect(formatPrice(1234.5)).toBe("1,234.50");
  });

  it("ゼロを処理する", () => {
    expect(formatPrice(0)).toBe("0.00");
  });

  it("負数を処理する", () => {
    expect(formatPrice(-100)).toBe("-100.00");
  });
});
```

## よく使うマッチャー

```javascript
// 等価
expect(1 + 1).toBe(2); // 厳密等価 ===
expect({ a: 1 }).toEqual({ a: 1 }); // 深い等価

// 真偽
expect(true).toBeTruthy();
expect(null).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();

// 数値
expect(5).toBeGreaterThan(3);
expect(5).toBeLessThanOrEqual(5);

// 文字列
expect("hello world").toContain("world");
expect("hello").toMatch(/^hel/);

// 配列
expect([1, 2, 3]).toContain(2);
expect([1, 2, 3]).toHaveLength(3);

// オブジェクト
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); // サブセットのマッチで十分

// 例外
expect(() => {
  throw new Error("oops");
}).toThrow("oops");
```

## 非同期コードのテスト

```javascript
// async/await（推奨）
it("fetchUser が正しいデータを返す", async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe("Alice");
});

// Promise スタイル
it("fetchUser が正しいデータを返す", () => {
  return fetchUser(1).then((user) => {
    expect(user.name).toBe("Alice");
  });
});
```

## モック関数

```javascript
// jest.fn() でモック関数を作成
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // 戻り値を設定
mockFn.mockResolvedValue({ id: 1, name: "Alice" }); // Promise の戻り値を設定

// 呼び出し後に検証
mockFn("arg1", "arg2");
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(1);
```

## モジュールのモック

```javascript
// axios リクエストをモック
jest.mock("axios");
import axios from "axios";

it("API を呼び出してユーザーデータを取得する", async () => {
  axios.get.mockResolvedValue({ data: { id: 1, name: "Alice" } });

  const user = await getUser(1);

  expect(axios.get).toHaveBeenCalledWith("/api/users/1");
  expect(user.name).toBe("Alice");
});
```

## Vue コンポーネントのテスト

```javascript
// __tests__/Button.spec.js
import { mount } from "@vue/test-utils";
import Button from "@/components/Button.vue";

describe("Button コンポーネント", () => {
  it("デフォルト slot のコンテンツをレンダリングする", () => {
    const wrapper = mount(Button, {
      slots: { default: "クリック" },
    });
    expect(wrapper.text()).toContain("クリック");
  });

  it("クリックで click イベントを発火する", async () => {
    const wrapper = mount(Button);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("disabled のときイベントを発火しない", async () => {
    const wrapper = mount(Button, {
      propsData: { disabled: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("loading のときローディング状態を表示する", () => {
    const wrapper = mount(Button, {
      propsData: { loading: true },
    });
    expect(wrapper.find(".loading-icon").exists()).toBe(true);
  });
});
```

## テストカバレッジ

```bash
npm run test:coverage
```

レポートのいくつかの指標に注目します：

- **Statements**：ステートメントカバレッジ
- **Branches**：分岐カバレッジ（if/else の両方を実行したか）
- **Functions**：関数カバレッジ
- **Lines**：行カバレッジ

100% を目指す必要はありません。ユーティリティ関数とコアビジネスロジックを重点的にカバーし、UI 表示系は少なめでも可です。

## まとめ

- まず純粋関数からテストを書き始める — 最もハードルが低い
- `expect().toBe()` が基本、オブジェクトには `toEqual()` を使う
- 非同期テストには `async/await` を使う
- コンポーネントテストには `@vue/test-utils` でインタラクションをテストする
- テストがあれば、リファクタリングが自信を持って行える
