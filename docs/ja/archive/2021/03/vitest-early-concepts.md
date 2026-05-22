---
title: "Jest の過去と現在：Vite ネイティブテストフレームワークの構想"
date: 2021-03-15 11:13:15
tags:
  - Vite
  - テスト

readingTime: 5
description: "コミュニティで最近話題になっているテーマがあります。Vite が開発とビルドの問題を解決したのに、なぜテストの段階だけは独立した Vite とは無関係のツールチェーンが必要なのでしょうか。テストは Node 上で実行され、Jest の transform 設定を使うため、結局 Babel や TypeScript コンパイルの仕組みに戻ってしまいます。もしテストも Vite のモジュール解決と変換能力を再利用できたらどうでしょうか。"
wordCount: 1196
---

最近コミュニティで話題になっているのが、Vite が開発とビルドの問題を解決したのに、なぜテストの段階だけは独立した Vite とは無関係のツールチェーンが必要なのか、ということです。テストは Node 上で実行され、Jest の transform 設定を使うため、結局 Babel や TypeScript コンパイルの仕組みに戻ってしまいます。もしテストも Vite のモジュール解決と変換能力を再利用できたらどうでしょうか。

## 既存テストツールの課題

Jest を使って Vite プロジェクトでテストを実行すると、設定が複雑でエラーが発生しやすくなります：

```javascript
// jest.config.js —— Vite + Vue 3 + TypeScript プロジェクトの典型的な設定
module.exports = {
  // transform を設定して TS を処理する必要がある
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue3-jest'
  },

  // モジュールエイリアスの設定が必要（vite.config.ts と重複）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // ファイル拡張子の設定が必要
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'vue'],

  // 環境の設定が必要
  testEnvironment: 'jsdom',

  // CSS ファイルはモックする
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(png|jpg|svg)$': '<rootDir>/__mocks__/fileMock.js'
  }
}
```

いくつかの問題は明らかです：

1. **設定の重複**：vite.config.ts でエイリアス、CSS プリプロセス、TS 変換を設定し、jest.config.js でも同じ設定を繰り返す
2. **変換チェーンの違い**：Vite は esbuild でコンパイルするが、Jest は Babel/ts-jest を使用し、2つのコンパイル結果に不一致が生じる可能性がある
3. **デバッグの困難さ**：テストと開発で異なるツールチェーンを使うため、問題が発生した場合の特定が難しい

## Vite の設計思想の再利用

核となるアイデアは非常に直接的です：テストも Vite のモジュール処理パイプラインを通すことです。Vite 内部には既に transform パイプラインがあり、TypeScript、Vue SFC、CSS Modules、静的アセットなどを処理しています。テストはこれを再利用するだけで良いのです。

```
現在のツールチェーン：
  開発: Vite (esbuild) → ブラウザ
  テスト: Jest (Babel/ts-jest) → Node/JSDOM
  ビルド: Vite (Rollup) → 本番

理想の状態：
  開発: Vite → ブラウザ
  テスト: Vite → Node/JSDOM
  ビルド: Vite → 本番
```

この考えに基づいて、Vite ネイティブのテストランナーを設計できます。核となるのは Vite の `createServer` API を利用してモジュール変換を行うことです：

```javascript
// 概念実証：Vite をテストのモジュールローダーとして使用
import { createServer } from 'vite'

async function createTestRunner() {
  // プロジェクトの vite.config.ts を再利用
  const server = await createServer({
    // HTTP サーバーを起動する必要はない
    server: { middlewareMode: true },
    // テスト環境設定
    optimizeDeps: { disabled: true },
    // 一部の設定を上書き
    mode: 'test'
  })

  // Vite の transform 機能を利用してモジュールを処理
  async function loadModule(filepath) {
    // Vite が TS、Vue SFC、CSS などを処理
    const result = await server.transformRequest(filepath)
    // Node 内で実行
    return executeInNode(result.code)
  }

  return { loadModule, close: () => server.close() }
}
```

## 仮定の API デザイン

Vite ネイティブのテストフレームワークを設計するなら、API はどのようなものになるべきでしょうか？

```typescript
// jest.config.ts —— Vite 設定を直接再利用
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,          // グローバル API（describe/it/expect）
    environment: 'jsdom',   // または 'happy-dom'
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules'],
    coverage: {
      provider: 'c8',       // または 'istanbul'
      reporter: ['text', 'html']
    }
  }
})
```

テストファイルの書き方は Jest と似ていますが、追加の設定は不要です：

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'jest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('should format number to currency', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
  })

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('should format date to yyyy-MM-dd', () => {
    const date = new Date(2021, 2, 15)
    expect(formatDate(date)).toBe('2021-03-15')
  })
})
```

コンポーネントテスト：

```typescript
// src/components/Button.test.ts
import { describe, it, expect } from 'jest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' }
    })
    expect(wrapper.text()).toContain('Click me')
  })

  it('emits click event', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disables when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

## 既存ソリューションとの比較

| 観点 | Jest | 将来のソリューション（Vite ネイティブ） |
|------|------|---------------------|
| 設定 | 独立した設定、Vite と重複 | vite.config.ts を継承 |
| 変換 | Babel/ts-jest | Vite transform（esbuild） |
| 速度 | 中程度 | より高速（esbuild コンパイル） |
| エコシステム | 成熟（jest-dom、msw 等） | 互換レイヤーが必要 |
| モジュール処理 | CommonJS 主体 | ESM ネイティブ |
| Mock | jest.mock() | import.meta.jest または類似 |

## 将来への展望

いくつかの方向性が注目に値します：

1. **esbuild によるテストファイルのコンパイル**：Babel よりはるかに高速で、TypeScript サポートも追加設定不要
2. **ESM ネイティブ**：ESM を CJS に変換する `transform` が不要になり、テストは ESM のまま実行可能
3. **Jest 互換**：上位 API は Jest と互換性があり、移行コストが低い
4. **JSDOM / happy-dom**：統一された DOM 環境管理
5. **Watch モードでの Vite HMR 活用**：ファイル変更時に Vite の HMR パイプラインを利用した差分更新

コミュニティがこの方向性をうまく進められれば、2021 年下半期にはフロントエンドのツールチェーンが真に Vite で統一されるでしょう——開発、テスト、ビルドがすべて1つの設定で完結します。

## まとめ

- 現在のテストツールチェーンは Vite の開発ツールチェーンと分断されており、設定が重複し、コンパイラも統一されていない
- 核となる考え方は Vite の transform パイプラインを再利用し、テストも esbuild でコンパイルすること
- API 設計では vite.config.ts を継承することで、設定の重複を削減できる
- Jest のエコシステムは成熟しており、新しいソリューションには互換レイヤー（Jest の describe/it/expect API）が必要
- この方向性は期待に値し、2021 年下半期にも実現する可能性がある
