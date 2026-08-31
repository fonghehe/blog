---
title: "React 复合组件模式"
date: 2021-03-03 14:50:25
tags:
  - React
  - TypeScript
readingTime: 2
description: "React 复合组件模式在前端开发中的应用越来越广泛。本文从实际项目出发，深入分析其核心原理和最佳实践。"
wordCount: 285
---

React 复合组件模式在前端用得越来越普遍。本文结合实际项目，聊聊它的核心思路和落地方式。

## 基础用法

先看最基础的写法：

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

把逻辑抽成 Hook 之后，代码更好测，也更容易扩展。

## 进阶用法

再往前一步，看一个更完整的例子：

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

边界情况要处理好，生产环境里这点很关键。

## 实战案例

理解核心逻辑，剩下的就是怎么用：

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

性能优化得看具体场景，不是每处都值得过度优化。

## 性能优化

可以从这几个角度去改进：

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

这套写法已经在线上稳定跑了半年多，是经过实战检验的。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- React 复合组件模式不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
- 团队协作中约定和文档比技术本身更重要