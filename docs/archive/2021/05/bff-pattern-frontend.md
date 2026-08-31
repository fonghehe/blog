---
title: "BFF Backend For Frontend 模式"
date: 2021-05-28 14:31:38
tags:
  - 前端
  - 工程化
readingTime: 1
description: "在日常开发中，BFF Backend For Frontend 模式的使用频率越来越高。本文系统地讲解其用法、原理和优化策略。"
wordCount: 237
---

日常开发中，BFF（Backend For Frontend）模式越来越常见。本文系统讲解它的用法、原理和优化思路。

## 快速上手

先看基础用法：

```javascript
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

以上只是最小示例，实际项目里还要处理错误与边界条件。

## 内部原理

在此基础上还可以继续优化：

```javascript
import { useState, useEffect, useCallback } from 'react'

function DataList({ endpoint, pageSize = 20 }) {
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?page=${page}&size=${pageSize}`)
      setData(await res.json())
    } finally { setLoading(false) }
  }, [endpoint, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  return <div>{loading ? <Spinner /> : <List items={data} />}</div>
}

```

在大型项目里这套模式很实用，能明显降低维护成本。

## 业务实战

实际项目中的用法更复杂：

```javascript
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

interface AppConfig {
  api: { baseUrl: string; timeout: number; retries: number }
  ui: { theme: 'light' | 'dark'; language: string; pageSize: number }
}

type PartialConfig = DeepPartial<AppConfig>

function mergeConfig(defaults: AppConfig, overrides: PartialConfig): AppConfig {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    if (overrides[key] && typeof overrides[key] === 'object') {
      result[key] = { ...defaults[key], ...overrides[key] } as any
    }
  }
  return result
}

```

借助这种方式，代码的可测试性和可扩展性都更好。

## 性能对比

下面给出一个完整示例：

```javascript
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

注意处理边界条件，在生产环境里这点尤为关键。

## 小结

- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- BFF（Backend For Frontend）模式不是银弹，需结合项目规模和技术栈选择