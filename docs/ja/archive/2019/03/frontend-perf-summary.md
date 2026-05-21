---
title: "フロントエンドパフォーマンス最適化手法まとめ"
date: 2019-03-11 10:41:26
tags:
  - フロントエンド
readingTime: 1
description: "チームにフロントエンドパフォーマンス最適化手法を普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。"
wordCount: 227
---

チームにフロントエンドパフォーマンス最適化手法を普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。

## はじめに

コアコードは以下の通り：

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

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## 応用的な使い方

実際の例を見てみよう：

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

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## ビジネスシナリオ

以下の方法で実現できる：

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

上記コードのパフォーマンスの詳細に注意し、不要な計算を避けること。
