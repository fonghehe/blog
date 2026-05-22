---
title: "Vue 2トランジションとアニメーションシステム"
date: 2019-09-06 10:53:29
tags:
  - Vue
readingTime: 2
description: "最近のプロジェクトで Vue 2 のトランジションとアニメーションシステムを使用してみて、思ったより複雑だと感じました。実践で得た経験を共有します。"
wordCount: 427
---

最近のプロジェクトで Vue 2 のトランジションとアニメーションシステムを使用してみて、思ったより複雑だと感じました。実践で得た経験を共有します。

## クイックスタート

具体的な実装は以下のコードを参考にしてください：

```css
function pLimit(concurrency) {
  const queue = []
  let active = 0

  const next = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    fn().then(resolve, reject).finally(() => {
      active--
      next()
    })
  }

  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    next()
  })
}
```

本番環境での検証を経て、この手法は安定して動作しています。

## 高度な使い方

まず基本的な使い方を見てみましょう：

```css
class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    const handlers = this.events.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  emit(event, ...args) {
    const handlers = this.events.get(event) || []
    handlers.forEach(h => h(...args))
  }
}
```

この書き方はシンプルで明快であり、ほとんどのシナリオに適しています。

## ビジネスシナリオ

コアコードは次のとおりです：

```css
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

実際のプロジェクトでは、境界条件と例外処理も考慮する必要があります。

## 落とし穴回避ガイド

以下は実際の例です：

```css
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '张三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

このパターンをチームで導入したところ効果が高く、メンテナンスコストが明らかに低下しました。

## まとめ

- 問題が発生したら、ソースコードと公式ドキュメントをよく確認すること
- Vue 2 のトランジションとアニメーションシステムの鍵はコアコンセプトを理解することであり、表面的な使い方に留まらないこと
- 実際のプロジェクトではシナリオに応じて適切な方法を選択すること
