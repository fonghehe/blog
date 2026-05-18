---
title: "React 19 Compiler 自动记忆化"
date: 2024-01-01 09:31:08
tags:
  - React
readingTime: 2
description: "关于React 19 Compiler 自动记忆化，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。"
---

关于React 19 Compiler 自动记忆化，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。

## 基本原理

先来看基本的实现方式：

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

这段代码展示了基本的使用方式。实际项目中还需要考虑错误处理和边界条件。

## 高级特性

在这个基础上，我们可以进一步优化：

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

这种模式在大型项目中非常实用，能显著降低维护成本。

## 项目实践

实际项目中的用法会更复杂一些：

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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## 最佳实践

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## 小结

- 关注社区动态，技术方案需要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整