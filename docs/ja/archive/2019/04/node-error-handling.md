---
title: "Node.jsエラー処理のベストプラクティス"
date: 2019-04-15 11:14:06
tags:
  - Node.js
readingTime: 2
description: "Node.jsのエラー処理ベストプラクティスに関する記事はネット上にたくさんありますが、実践的な経験に基づくものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。"
wordCount: 335
---

Node.jsのエラー処理ベストプラクティスに関する記事はネット上にたくさんありますが、実践的な経験に基づくものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。

## クイックスタート

実際の例を見てみましょう：

```javascript
function pLimit(concurrency) {
  const queue = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}
```

このパターンをチームに展開した結果、効果は非常に良く、メンテナンスコストが明らかに下がりました。

## 高度な使い方

以下の方法で実装できます：

```javascript
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.events.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    }
  }

  emit(event, ...args) {
    const handlers = this.events.get(event) || [];
    handlers.forEach((h) => h(...args));
  }
}
```

上記コードのパフォーマンス上の注意点に気をつけ、不要な計算を避けましょう。

## 型を使ったエラー処理

エラーを型付けして、運用エラーとプログラマーエラーを区別しましょう：

```javascript
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
}

function createUser(data: Partial<User>): User {
  return {
    id: Date.now(),
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'user'
  }
}

type UserKeys = keyof User  // 'id' | 'name' | 'email' | 'role'
```

常に適切なレイヤーでエラーを処理しましょう。運用エラーは捕捉してグレースフルに対処し、プログラミングエラーはプロセスをクラッシュさせてすぐに修正できるようにすべきです。
