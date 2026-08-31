---
title: "ES2021 新機能：実用主義的な更新"
date: 2021-07-28 15:09:57
tags:
  - JavaScript

readingTime: 3
description: "TC39 在 2021 年 6 月正式发布了 ES2021 标准。和 ES2020 的 `Optional Chaining`、`Nullish Coalescing` 这种重磅特性相比，ES2021 的更新更偏向实用主义——每个特性都不大，但写代码时确实用得上。"
wordCount: 550
---

TC39 は 2021 年 6 月に ES2021 を正式リリースした。ES2020 の `Optional Chaining` や `Nullish Coalescing` のような目玉機能と比べると、ES2021 の更新は実用主義に寄っている──どれも小さな機能だが、コードを書くときに確実に役立つ。

## String.prototype.replaceAll

ついに正規表現や `split().join()` を書かずに済むようになった：

```javascript
// 以前的写法
const text = 'hello world, hello everyone'
const result1 = text.replace(/hello/g, 'hi')       // 需要正则
const result2 = text.split('hello').join('hi')       // 不够直观

// ES2021
const result3 = text.replaceAll('hello', 'hi')
// 'hi world, hi everyone'

// 注意：第一个参数是正则时不加 g 标志会报错
text.replaceAll(/hello/g, 'hi')  // OK
text.replaceAll(/hello/, 'hi')   // TypeError
```

## Promise.any

`Promise.all` と逆に、`Promise.any` は最初の Promise が fulfilled になった時点で resolve する：

```javascript
const promises = [
  fetch('/api/cache-server').then(r => r.json()),    // 可能超时
  fetch('/api/cdn-server').then(r => r.json()),      // 比较快
  fetch('/api/origin-server').then(r => r.json())    // 最慢
]

// 只要有一个成功就返回
const fastest = await Promise.any(promises)
console.log('最快返回的数据:', fastest)

// 全部失败才 reject，抛出 AggregateError
try {
  await Promise.any([
    Promise.reject('error 1'),
    Promise.reject('error 2')
  ])
} catch (err) {
  console.log(err.errors) // ['error 1', 'error 2']
}
```

`Promise.race` との違いは、`race` は最初に settled になったもの（成否を問わず）を返すのに対し、`any` は最初に fulfilled になったもの（成功のみ）を返す点だ。

実際の場面：複数の CDN ソース間の競争や、複数データソースのフェイルオーバーなど。

## 論理代入演算子

条件付き代入を簡略化する、3 つの新しい複合代入演算子：

```javascript
// ||=  等价于 x = x || y（假值时赋值）
let config = {}
config.timeout ||= 3000
// 如果 config.timeout 是假值，赋值为 3000

// &&=  等价于 x = x && y（真值时赋值）
let user = { name: '张三' }
user.name &&= user.name.toUpperCase()
// user.name 是真值，执行赋值

// ??=  等价于 x = x ?? y（null/undefined 时赋值）
let settings = { theme: null }
settings.theme ??= 'dark'
// theme 是 null，赋值为 'dark'

// 对比
settings.theme = settings.theme || 'dark' // 会覆盖 0, '' 等假值
settings.theme ??= 'dark'                 // 只覆盖 null 和 undefined
```

設定のマージやデフォルト値の設定を扱うときに特に便利だ。

## WeakRef と FinalizationRegistry

`WeakRef` はオブジェクトの弱参照を作ることを許し、GC による回収を妨げない：

```javascript
let cache = new Map()

function getCachedData(key) {
  const ref = cache.get(key)
  if (ref) {
    const data = ref.deref()
    if (data) return data
  }

  // 缓存不存在或已被 GC，重新加载
  const data = loadFromServer(key)
  cache.set(key, new WeakRef(data))
  return data
}

// 配合 FinalizationRegistry 清理
const registry = new FinalizationRegistry((key) => {
  console.log(`${key} 的缓存已被 GC 回收`)
  cache.delete(key)
})

function cacheData(key, data) {
  cache.set(key, new WeakRef(data))
  registry.register(data, key)
}
```

この機能は主にメモリに敏感なキャッシュの場面で使われ、日常的な業務開発ではあまり使われない。

## 数値セパレーター

単なるシンタックスシュガーで、大きな数値を読みやすくする：

```javascript
const billion = 1_000_000_000
const bytes = 0xFF_FF_FF_FF
const binary = 0b1111_0000_0000
const creditCard = '4916_1234_5678_9012'

// 可以随意分组
const price = 99_999.99
const maxInt = 9_007_199_254_740_991
```

## まとめ

- `replaceAll` は文字列置換の長年の悩みの種を解決した
- `Promise.any` は Promise の組み合わせメソッドの最後のピースを埋めた
- 論理代入演算子は条件付き代入を簡潔にし、なかでも `??=` が最も実用的だ
- `WeakRef` の場面はやや特殊で、大半の業務では必要ない
- 数値セパレーターは純粋な可読性の向上だ
- これらの機能は Node.js 16 とすべてのモダンブラウザですでに全面サポートされている
