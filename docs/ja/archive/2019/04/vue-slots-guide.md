---
title: "Vue 2 スロット完全ガイド"
date: 2019-04-03 15:05:23
tags:
  - Vue
readingTime: 1
description: "Vue 2のスロットは日々の開発でよく直面する問題です。本記事では実際のプロジェクトをベースに、具体的な実装方法と経験からの知見を紹介します。"
---

Vue 2のスロットは日々の開発でよく直面する問題です。本記事では実際のプロジェクトをベースに、具体的な実装方法と経験からの知見を紹介します。

## 基本的な使い方

基本的な使い方から見てみましょう：

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

この書き方はシンプルで明快であり、ほとんどのシナリオに適しています。

## 応用テクニック

コアとなる実装：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: 'Alice', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

実際のプロジェクトでは、エッジケースと例外処理も考慮する必要があります。

## 実践ケース

実際の例を見てみましょう：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-gap: 1.5rem;
}

.grid__item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.grid__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

このパターンをチームに展開した後、効果は非常に良く、メンテナンスコストが明らかに下がりました。

## 注意事項

Vue 2には3種類のスロットがあります：デフォルトスロット、名前付きスロット、スコープ付きスロットです。スコープ付きスロットはVue 2.6で新しい統一`v-slot`構文により大幅に改善されました。
