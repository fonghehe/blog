---
title: "JavaScript Proxy と Reflect によるメタプログラミング"
date: 2018-12-13 16:17:56
tags:
  - JavaScript
readingTime: 2
description: "Proxy は ES2015 で追加されましたが、あまり使われていませんでした。Vue 3 のリアクティブシステムが Proxy に基づいているため、しっかり理解する時が来ました。"
wordCount: 391
---

Proxy は ES2015 で追加されましたが、あまり使われていませんでした。Vue 3 のリアクティブシステムが Proxy に基づいているため、しっかり理解する時が来ました。

## Proxy の基礎

Proxy はオブジェクトへの様々な操作をインターセプトできます：

```javascript
const handler = {
  // プロパティの読み取りをインターセプト
  get(target, prop, receiver) {
    console.log(`${prop} を読み取り`);
    return Reflect.get(target, prop, receiver);
  },

  // プロパティの設定をインターセプト
  set(target, prop, value, receiver) {
    console.log(`${prop} = ${value} を設定`);
    return Reflect.set(target, prop, value, receiver);
  },

  // delete をインターセプト
  deleteProperty(target, prop) {
    console.log(`${prop} を削除`);
    return Reflect.deleteProperty(target, prop);
  },

  // in 演算子をインターセプト
  has(target, prop) {
    return prop !== "secret" && Reflect.has(target, prop);
  },
};

const obj = { name: "Alice", secret: "パスワード" };
const proxy = new Proxy(obj, handler);

proxy.name; // ログ：name を読み取り
proxy.age = 25; // ログ：age = 25 を設定
"secret" in proxy; // false（インターセプトされた）
```

## リアクティブの実装（Vue 3 の原理）

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      // 依存関係のトラッキング
      track(target, prop);
      const value = Reflect.get(target, prop, receiver);
      // 値がオブジェクトなら再帰的にプロキシ化
      return typeof value === "object" && value !== null
        ? reactive(value)
        : value;
    },

    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      // 更新をトリガー
      trigger(target, prop);
      return result;
    },
  });
}

const state = reactive({ count: 0, user: { name: "Alice" } });

effect(() => {
  console.log("count:", state.count); // 依存関係を自動的にトラッキング
});

state.count++; // effect を再実行させる
state.user.name = "Bob"; // 深いプロパティもトラッキングできる！（Object.defineProperty ではできない）
```

Vue 2 は `Object.defineProperty` を使っているため：

- 新しいプロパティの追加を検知できない（`Vue.set` が必要）
- 配列のインデックスへの代入を検知できない

Vue 3 は Proxy でこれらの問題を解決しています。

## Reflect：オブジェクト操作の標準化

`Reflect` は Proxy のハンドラーメソッドに対応する静的メソッドを提供します：

```javascript
// 以前の書き方
Object.defineProperty(obj, "name", { value: "Alice" });
"name" in obj;
delete obj.name;

// Reflect の書き方（より統一的。成功/失敗を真偽値で返す）
Reflect.defineProperty(obj, "name", { value: "Alice" });
Reflect.has(obj, "name");
Reflect.deleteProperty(obj, "name");

// Reflect.get で this が正しく渡される（receiver パラメーター）
Reflect.get(target, prop, receiver); // receiver は proxy 自身
```

## 実用的な応用：データバリデーション

```javascript
function createValidator(target, validators) {
  return new Proxy(target, {
    set(target, prop, value) {
      const validator = validators[prop];
      if (validator && !validator(value)) {
        throw new TypeError(`${prop} の値 "${value}" は不正です`);
      }
      return Reflect.set(target, prop, value);
    },
  });
}

const user = createValidator(
  {},
  {
    age: (v) => Number.isInteger(v) && v >= 0 && v <= 150,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
);

user.age = 25; // ✅
user.age = -1; // ❌ TypeError
user.email = "invalid"; // ❌ TypeError
```

## まとめ

- Proxy はオブジェクトへの様々な操作（get/set/delete など）をインターセプトできる。defineProperty より強力
- Reflect はオブジェクト操作の統一 API を提供し、通常は Proxy のハンドラーと組み合わせて使う
- Vue 3 は Proxy ベースのリアクティブシステムで、Vue 2 の新規プロパティ検知の問題を解決した
- Proxy はポリフィルできないため、ES2015+ をサポートする環境でのみ使用可能
