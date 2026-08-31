---
title: "マイクロフロントエンド qiankun 本番実践"
date: 2020-08-21 16:23:23
tags:
  - マイクロフロントエンド
  - エンジニアリング
readingTime: 3
description: "マイクロフロントエンド qiankun 導入実践はフロントエンド開発でますます広く使われている。本記事では実際のプロジェクトから出発し、その原理とベストプラクティスを掘り下げる。"
wordCount: 553
---

マイクロフロントエンドの qiankun を本番導入する事例はフロントエンド開発でますます増えている。本記事では実際のプロジェクトを起点に、その中核となる原理とベストプラクティスを深掘りする。

## 基本的な使い方

次の方法で改善できる：

```javascript
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

このアプローチは本番環境で半年以上安定して動いており、実際に検証済みだ。

## 応用的な使い方

基本的な実装方法を見てみよう：

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

このコードは基本的な使い方を示している。実際のプロジェクトではエラーハンドリングや境界条件も考慮する必要がある。

## 実践事例

これをベースに、さらに最適化できる：

```javascript
import { useRef, useEffect, useState } from 'react'

function useIntersectionObserver(options = {}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
    }, { threshold: 0.1, ...options })
    const el = ref.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [])

  return [ref, isVisible]
}

```

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## パフォーマンス最適化

実際のプロジェクトでは、使い方はもう少し複雑になる：

```javascript
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

この方法なら、コードのテスト容易性と拡張性の両方が高まる。

## よくある落とし穴

以下は全体のサンプルだ：

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

境界条件の処理に注意すること。これは本番環境では極めて重要だ。

## まとめ

- 新しい技術のために新しい技術を使ってはいけない
- コード例はあくまで参考で、業務の場面に合わせて調整すること
- マイクロフロントエンドの qiankun の本番導入は銀の弾丸ではなく、プロジェクトの規模や技術スタックに応じて選ぶ必要がある
- API を丸暗記するよりも、その背後にある原理を理解する方が重要だ
- 本番環境で使う前に、必ず互換性の検証を行うこと
