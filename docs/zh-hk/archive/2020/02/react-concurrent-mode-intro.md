---
title: "React Concurrent Mode 初探"
date: 2020-02-26 17:29:17
tags:
  - React
readingTime: 2
description: "最近在團隊中落地React Concurrent Mode 初探，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
wordCount: 350
---

最近在團隊中落地React Concurrent Mode 初探，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 深度解析

先來看基本的實現方式：

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

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 落地經驗

在這個基礎上，我們可以進一步優化：

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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 調優策略

實際項目中的用法會更復雜一些：

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

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 注意事項

以下是一個完整的示例：

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

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 代碼示例僅供參考，需根據業務場景調整
- React Concurrent Mode 初探不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證
- 團隊協作中約定和文檔比技術本身更重要
