---
title: "Vitest 1.0：フロントエンドテストの次世代標準"
date: 2023-02-22 09:48:36
tags:
  - Vite
  - Vitest
readingTime: 3
description: "Vitest 1.0 が正式にリリースされました。0.x から 1.0 への移行により、「面白い実験」から本番環境で真剣に使えるテストフレームワークへと進化しました。"
wordCount: 745
---

Vitest 1.0 が正式にリリースされました。0.x から 1.0 への移行により、「面白い実験」から本番環境で真剣に使えるテストフレームワークへと進化しました。

## Jest からの移行理由

私たちのプロジェクトの課題：

1. **ESM サポートの悪さ**：Jest の ESM サポートは中途半端で、様々な transform 設定が必要でした
2. **設定の煩雑さ**：`jest.config.js` に大量の `moduleNameMapper` や `transform` ルールが必要でした
3. **速度の遅さ**：大規模プロジェクトではテスト完了に 2-3 分かかっていました
4. **Vite 設定との分断**：Vite には alias やプラグイン体系があるのに、Jest は対応していませんでした

Vitest は Vite の設定とプラグインシステムを直接再利用でき、ESM、TypeScript、CSS Modules をネイティブサポートしています。

## 基本設定

```typescript
// vite.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.{ts,tsx}"],
    },
  },
});
```

Jest の設定と比較すると、大幅に簡素化されています。`moduleNameMapper` は不要で、Vite の `resolve.alias` をそのまま使用できます。

## テストを書く

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Counter } from "./Counter";

describe("Counter", () => {
  it("点击按钮后计数增加", async () => {
    render(<Counter />);
    const button = screen.getByRole("button");

    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("调用 onChange 回调", () => {
    const onChange = vi.fn();
    render(<Counter onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

`vi.fn()` は `jest.fn()` の代替、`vi.mock()` は `jest.mock()` の代替であり、API はほぼ同じなので移行コストは低いです。

## 独自の優位性

### In-Source Testing

```typescript
// utils.ts
export function add(a: number, b: number) {
  return a + b;
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it("add", () => {
    expect(add(1, 2)).toBe(3);
  });
}
```

テストをソースコードに直接記述でき、ユーティリティ関数に特に便利です。`import.meta.vitest` は本番ビルド時に tree-shake で除去されます。

### UI モード

```bash
vitest --ui
```

Vitest には Web UI が標準で付属しており、テスト結果やカバレッジを視覚的に確認できます。追加のプラグインは不要です。

### スナップショットテスト

```typescript
it("渲染一致性", () => {
  const { container } = render(<UserCard user={mockUser} />);
  expect(container).toMatchSnapshot();
});
```

スナップショット形式は Jest と互換性があり、既存のスナップショットファイルをそのまま再利用できます。

## パフォーマンス比較

私たちのプロジェクト（約 800 テストケース）での比較：

```
Jest:    68s
Vitest:  12s （シングルスレッド）
Vitest:  5s  （マルチスレッド、デフォルトで有効）
```

Vitest はデフォルトで worker threads を使用してテストを並列実行するため、速度が大幅に向上します。

## 移行の推奨

```bash
# 1. インストール
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui

# 2. API を一括置換
# jest.fn()    -> vi.fn()
# jest.mock()  -> vi.mock()
# jest.spyOn() -> vi.spyOn()
# jest.useFakeTimers() -> vi.useFakeTimers()

# 3. jest 関連の依存関係を削除
# jest, ts-jest, @types/jest, babel-jest, jest-environment-jsdom
```

ほとんどのプロジェクトの移行は 1〜2 日で完了できます。Jest の matcher API（`toBe`、`toEqual` など）は完全に互換性があります。

## まとめ

- Vitest 1.0 は安定して使用可能で、Jest より 5〜10 倍高速です
- Vite 設定を再利用でき、Jest + Vite の設定分断問題が解消されます
- ESM、TypeScript をネイティブサポートし、追加の transform は不要です
- Jest からの移行コストは低く、API の互換性が高いです
- In-Source Testing と UI モードは追加の魅力です
