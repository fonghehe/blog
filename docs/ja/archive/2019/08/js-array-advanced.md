---
title: "JavaScript配列の高度なメソッド"
date: 2019-08-20 11:02:36
tags:
  - JavaScript
readingTime: 2
description: "チームでJavaScriptの配列の高度なメソッドを広める过程中に、いくつか落とし穴にハマった。まとめておくので参考になれば幸いだ。"
wordCount: 340
---

チームでJavaScriptの配列の高度なメソッドを広める过程中に、いくつか落とし穴にハマった。まとめておくので参考になれば幸いだ。

## 基本概念

コアとなるコードは以下のとおり：

```javascript
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (map.has(obj)) return map.get(obj)

  const clone = Array.isArray(obj) ? [] : {}
  map.set(obj, clone)

  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key], map)
  }
  return clone
}
```

実際のプロジェクトでは、境界条件や例外処理も考慮する必要がある。

## 深掘り

以下は実際の例である：

```javascript
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

このパターンをチームに導入したところ効果が良く、保守コストが明らかに低下した。

## プロジェクト応用

以下の方法で実現できる：

```javascript
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

上記コードのパフォーマンス上の細部に注意し、不要な計算を避けること。

## まとめ

- 実際のプロジェクトでは、場面に応じて適切なアプローチを選ぶこと
- チーム内で統一した取り決めを作ることは、完璧な実装を追及するよりも重要だ
- 継続的に学び、振り返りを行い、技術に対する感度を保つこと
- 問題に直面したら、ソースコードと公式ドキュメントをよく確認すること
