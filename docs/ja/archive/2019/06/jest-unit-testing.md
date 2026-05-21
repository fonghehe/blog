---
title: "Jestフロントエンドユニットテスト実践ガイド"
date: 2019-06-19 10:41:50
tags:
  - テスト
readingTime: 1
description: "ユニットテストの価値はよく知られていますが、多くのフロントエンドプロジェクトでは導入のオーバーヘッドでスキップされています。本記事では完全なセットアップワークフローと実践的なテスト例を紹介し、実際のプロジェクトで遭遇するシナリオをカバーします。"
wordCount: 196
---

ユニットテストの価値はよく知られていますが、多くのフロントエンドプロジェクトでは導入のオーバーヘッドでスキップされています。本記事では完全なセットアップワークフローと実践的なテスト例を紹介し、実際のプロジェクトで遭遇するシナリオをカバーします。

## インストールと設定

```bash
npm install --save-dev jest babel-jest @babel/core @babel/preset-env
# Reactプロジェクトの場合、追加インストール:
npm install --save-dev @babel/preset-react @testing-library/react @testing-library/jest-dom
```

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterFramework": ["@testing-library/jest-dom/extend-expect"],
    "collectCoverageFrom": ["src/**/*.{js,jsx}", "!src/index.js"]
  }
}
```

```javascript
// babel.config.js
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-react",
  ],
};
```

## コアマッチャー

```javascript
// math.js — テスト対象の関数
export const sum = (a, b) => a + b;
export const subtract = (a, b) => a - b;
export const multiply = (a, b) => a * b;
export const divide = (a, b) => {
  if (b === 0) throw new Error("ゼロで割ることはできません");
  return a / b;
};
```

```javascript
// math.test.js
import { sum, subtract, multiply, divide } from "./math";

describe("数学ユーティリティ", () => {
  // 等値
  test("sum: 1 + 2 = 3", () => {
    expect(sum(1, 2)).toBe(3); // 厳密等価（===）
    expect(sum(1, 2)).toEqual(3); // 深い等価（オブジェクト・配列）
  });

  // 真偽値
  test("subtract: 結果は真偽値", () => {
    expect(subtract(5, 3)).toBeTruthy(); // 真値
    expect(subtract(3, 3)).toBeFalsy(); // 偽値
    expect(subtract(5, 3)).toBeDefined(); // undefinedでない
  });

  // 数値
  test("multiply: 2 * 3 = 6", () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(0.1, 0.2)).toBeCloseTo(0.02); // 浮動小数点比較
  });

  // 例外
  test("divide: ゼロ除算で例外をスロー", () => {
    expect(() => divide(10, 0)).toThrow("ゼロで割ることはできません");
    expect(() => divide(10, 0)).toThrow(Error);
  });

  // 配列とオブジェクト
  test("配列内の結果", () => {
    expect([1, 2, 3]).toContain(2);
    expect({ name: "アリス", age: 25 }).toMatchObject({ name: "アリス" });
  });
});
```

## 非同期テスト

```javascript
// 非同期関数
test("非同期関数のテスト", async () => {
  const data = await fetchUser(1);
  expect(data.name).toBe("アリス");
});

// 非同期リクエストのモック
jest.mock("./api", () => ({
  fetchUser: jest.fn().mockResolvedValue({ id: 1, name: "アリス" }),
}));
```

最も重要な純粋関数ロジックから始めましょう——副作用のない関数が最もテストしやすく、最も高い費用対効果を提供します。
