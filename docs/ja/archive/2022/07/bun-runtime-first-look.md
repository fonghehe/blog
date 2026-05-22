---
title: "Bun：JavaScriptランタイムの新たな挑戦者"
date: 2022-07-26 10:22:05
tags:
  - フロントエンド
readingTime: 3
description: "2022年7月、Jarred Sumner は Bun をリリースしました——Zig で記述された JavaScript ランタイムです。その目標は大胆です。Node.js、npm、esbuild、Jest を置き換え、JavaScript ツールチェーンの統一ソリューションとなることです。"
wordCount: 625
---

2022年7月、Jarred Sumner は Bun をリリースしました——Zig で記述された JavaScript ランタイムです。その目標は大胆です：Node.js、npm、esbuild、Jest を置き換え、JavaScript ツールチェインの統一ソリューションとなることです。

## インストールと基本的な使い方

```bash
# インストール
curl -fsSL https://bun.sh/install | bash

# 確認
bun --version
# 0.1.x（2022 年 7 月）

# TypeScript ファイルを実行（コンパイル不要）
bun run app.ts

# JSX/TSX を実行
bun run App.tsx

# パッケージ管理
bun install
bun add lodash
bun remove lodash
```

## どれほど速いのか

```bash
# TypeScript スクリプトを実行
time bun run script.ts
# 0.02s

time npx ts-node script.ts
# 1.8s

time node --loader ts-node/esm script.ts
# 2.1s
```

コールドスタートが100倍高速です。これはBunがV8ではなくJavaScriptCore（Safariのエンジン）を使用し、Zigで低レベルIOを記述しているためです。

## パッケージマネージャーとして

```bash
# 依存関係をインストール（pnpmより高速）
bun install

# 依存関係を追加
bun add react react-dom

# インストール速度を確認
time bun install
# node_modules: 0.3s

time pnpm install
# node_modules: 2.8s
```

Bun はハードリンクとグローバルキャッシュを使用します（pnpmと同様）が、実装がより高速です。

## 組み込みバンドラー

```typescript
// 直接バンドル
bun build ./src/index.ts --outdir ./dist

// 設定付き
bun build ./src/index.ts \
  --outdir ./dist \
  --minify \
  --sourcemap=external \
  --target=browser
```

```typescript
// build.ts
await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  minify: true,
  splitting: true, // コード分割
  target: 'browser',
  format: 'esm',
});
```

## 組み込みテストランナー

```typescript
// math.test.ts
import { expect, test, describe } from 'bun:test';
import { add, multiply } from './math';

describe('math', () => {
  test('加法', () => {
    expect(add(1, 2)).toBe(3);
  });

  test('乘法', () => {
    expect(multiply(3, 4)).toBe(12);
  });
});

// 実行
// bun test
```

Bun のテストランナーはJest APIと互換性がありますが、はるかに高速です。

## HTTP サーバー

```typescript
// server.ts
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/hello') {
      return Response.json({ message: 'Hello from Bun!' });
    }

    if (url.pathname === '/api/stream') {
      // ストリーム応答
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: hello\n\n'));
            controller.close();
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
```

パフォーマンス比較（単純なJSONレスポンス）：

```
Node.js (http):     ~50,000 req/s
Deno (oak):         ~80,000 req/s
Bun (Bun.serve):   ~250,000 req/s
```

## ファイル I/O

```typescript
// ファイル読み込み（Node.jsより10倍高速）
const file = Bun.file('data.json');
const data = await file.json();

// ファイル書き込み
await Bun.write('output.txt', 'Hello, Bun!');

// ファイルコピー
const src = Bun.file('source.txt');
await Bun.write('dest.txt', src);

// ファイル情報
console.log(file.size);     // バイト
console.log(file.type);     // MIME タイプ
console.log(file.lastModified);
```

## 現実の問題

2022年7月のBunはまだ非常に初期段階でした：

1. **互換性**：すべてのnpmパッケージが動作するわけではなく、特にNode.jsネイティブモジュールを使用しているもの
2. **安定性**：まだ0.xバージョンであり、APIが変更される可能性があります
3. **エコシステム**：コミュニティプラグインやツールチェインがありません
4. **Windowsサポート**：2022年時点では未対応

```bash
# プロジェクトの互換性をテスト
bun install
bun test
# おそらく一部のパッケージと互換性がありません
```

## Node.js と Deno との位置づけ

| 特性 | Node.js | Deno | Bun |
|------|---------|------|-----|
| エンジン | V8 | V8 | JavaScriptCore |
| 言語 | C++ | Rust | Zig |
| TypeScript | コンパイルが必要 | ネイティブ対応 | ネイティブ対応 |
| パッケージ管理 | npm/pnpm/yarn | URLインポート | 内蔵 |
| テスト | フレームワークが必要 | 内蔵 | 内蔵 |
| 成熟度 | 本番環境対応 | 比較的成熟 | 初期段階 |

## まとめ

Bun の方向性は正しいです——JavaScriptツールチェインを統一し、断片化を減らすことです。2022年のBunはまだ本番環境に適していませんが、その速度性能は印象的です。発展を注目しましょう。ただし、移行は急がないでください。2023年がBunにとって重要な年になるでしょう。