---
title: "React 18 startTransition 使用場景"
date: 2021-02-12 10:58:29
tags:
  - React
  - JavaScript
readingTime: 2
description: "最近在團隊中落地React 18 startTransition 使用場景，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
wordCount: 273
---

最近在團隊中落地React 18 startTransition 使用場景，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

先來看基本的實現方式：

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

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 深度解析

在這個基礎上，我們可以進一步最佳化：

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

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 落地經驗

實際專案中的用法會更復雜一些：

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

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 調優策略

以下是一個完整的示例：

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

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 關注社群動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 程式碼示例僅供參考，需根據業務場景調整
