---
title: "TypeScriptのオプショナルチェーンとNull合体演算子の実践"
date: 2020-01-07 16:46:58
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 3.7 でオプショナルチェーン（Optional Chaining）と Null 合体演算子（Nullish Coalescing）の 2 つの構文が導入され、長々とした && 判定を書かなくて済むようになりました。実際のプロジェクトでしばらく使用したので、ユースケースと注意点をまとめます。"
wordCount: 415
---

TypeScript 3.7 でオプショナルチェーン（Optional Chaining）と Null 合体演算子（Nullish Coalescing）の2つの構文が導入され、長々とした `&&` 判定を書かなくて済むようになりました。実際のプロジェクトでしばらく使用したので、ユースケースと注意点をまとめます。

## オプショナルチェーン?.が解決する問題

日常の開発で最もよくあるのは、深くネストされたオブジェクトのプロパティにアクセスすることです。以前は次のように書く必要がありました：

```typescript
// 以前：階層ごとに判定
const street = user && user.address && user.address.street;

// または lodash を使用
import get from 'lodash/get';
const street = get(user, 'address.street');
```

オプショナルチェーンを使えば、1行で済みます：

```typescript
// オプショナルチェーン：簡潔で明確
const street = user?.address?.street;

// メソッド呼び出しにもオプショナルチェーン
const result = user?.getAddress?.();

// 配列アクセス
const first = arr?.[0];
```

## Null合体演算子 ??

`||` との違いが重要です：`||` は `0`、`''`、`false` も falsy な値として扱いますが、`??` は `null` と `undefined` のみを扱います。

```typescript
const count = 0;

// || の問題：0 が falsy として扱われる
console.log(count || 10);  // 10 —— 間違い！

// ?? は null/undefined のみを対象
console.log(count ?? 10);  // 0 —— 正しい

// 典型的なシナリオ：API 戻り値のデフォルト値
interface Config {
  pageSize: number;
  theme: string;
}

function loadConfig(input: Partial<Config>): Config {
  return {
    pageSize: input.pageSize ?? 20,
    theme: input.theme ?? 'light',
  };
}
```

## 実際のプロジェクトへの応用

```typescript
// API レスポンス処理
interface ApiResponse {
  data?: {
    list?: Array<{
      id: number;
      name: string;
      avatar?: string;
    }>;
    total?: number;
  };
  code: number;
}

function renderUsers(res: ApiResponse) {
  const users = res.data?.list ?? [];
  const total = res.data?.total ?? 0;

  users.forEach(user => {
    // アバターのフォールバック
    const avatar = user.avatar ?? '/default-avatar.png';
    console.log(`${user.name}: ${avatar}`);
  });

  return { users, total };
}

// 条件付き実行
function notify(message: string, callback?: (msg: string) => void) {
  callback?.(message);
}

// Vue コンポーネントでの応用（TypeScript と組み合わせて）
// computed でよく使用
const userName = computed(() => {
  return store.state.user?.profile?.name ?? '未ログイン';
});
```

## TypeScript の設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}
```

ターゲットブラウザがサポートしていない場合、Babel がトランスパイルしてくれます：

```bash
npm install @babel/plugin-proposal-optional-chaining @babel/plugin-proposal-nullish-coalescing-operator -D
```

```json
// babel.config.json
{
  "plugins": [
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator"
  ]
}
```

## まとめ

- オプショナルチェーン `?.` により、深いプロパティへのアクセスが安全かつ簡潔に
- Null 合体演算子 `??` は `||` より正確で、`0`、`''`、`false` を誤判定しない
- TypeScript 3.7+ と組み合わせて使用すると、型推論も正しく追従
- 互換性に注意。古いプロジェクトでは Babel プラグインによるトランスパイルが必要
