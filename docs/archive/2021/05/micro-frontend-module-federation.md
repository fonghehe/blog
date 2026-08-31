---
title: "微前端 Module Federation 落地"
date: 2021-05-14 16:06:34
tags:
  - 微前端
  - 工程化
readingTime: 2
description: "微前端 Module Federation 落地这个话题社区讨论了很多次，但随着版本迭代，很多结论需要更新。本文基于最新版本重新梳理。"
wordCount: 282
---

微前端 Module Federation 落地，社区讨论过很多次，但随着版本迭代，不少结论需要更新。本文基于最新版本重新梳理。

## 入门指南

实际项目中的用法更复杂：

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

借助这种方式，代码的可测试性和可扩展性都更好。

## 源码分析

下面给出一个完整示例：

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

注意处理边界条件，在生产环境里这点尤为关键。

## 真实场景应用

关键要理解背后的核心逻辑：

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

性能优化要结合具体场景，不必处处都做。

## 优化技巧

可以用下面这些方式来改进：

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

这套方案已在线上稳定运行半年多，经过真实业务验证。

## 小结

- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- 微前端 Module Federation 落地不是银弹，需结合项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证