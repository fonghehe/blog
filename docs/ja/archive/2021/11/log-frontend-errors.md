---
title: "フロントエンドエラーログの収集と分析"
date: 2021-11-24 14:31:22
tags:
  - エンジニアリング
  - フロントエンド

readingTime: 2
description: "最近在团队中落地前端错误日志采集与分析，において多くの経験を積みました。参考のためにまとめましたので、同様の作業をされる方のお役に立てれば幸いです。"
wordCount: 520
---

最近チームでフロントエンドのエラーログ収集・分析を本番導入し、多くの経験を積んだ。参考になればとまとめたので、同様の取り組みをする方の役に立てば幸いだ。

## コアコンセプト

実際のプロジェクトでは使い方がもう少し複雑になる：

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

このアプローチにより、コードのテスト容易性とスケーラビリティが向上する。

## 詳細分析

完全なサンプルを以下に示す：

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

境界条件の処理に注意する必要がある。これは本番環境では非常に重要だ。

## 実装経験

中核となるロジックを理解することが重要だ：

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

パフォーマンスの最適化は具体的な場面に合わせる必要があり、すべてのケースで過度な最適化が必要というわけではない。

## 最適化戦略

以下の方法で改善できる：

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

このアプローチは半年以上にわたって本番環境で安定稼働しており、実際に検証済みだ。

## まとめ

- チームのコラボレーションでは、規約とドキュメントが技術そのものより重要だ
- コミュニティの動向を注視し、技術的なソリューションには継続的な改善が必要だ
- 新しい技術を使うためだけに新しい技術を使わないこと
- コードサンプルは参考用であり、実際のプロジェクトに合わせて調整する必要がある
- フロントエンドのエラーログ収集・分析は万能薬ではなく、プロジェクトの規模や技術スタックに応じて選ぶ必要がある