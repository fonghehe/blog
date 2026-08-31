---
title: "Advanced React useReducer and Context Composition Patterns"
date: 2020-02-20 10:12:00
tags:
  - React
readingTime: 2
description: "In day-to-day development, useReducer for state management is used more and more frequently. This article systematically covers its usage, internals, and optimization strategies."
wordCount: 184
---

In day-to-day development, `useReducer` for state management is being used more and more often. This article systematically explains its usage, internals, and optimization strategies.

## Quick Start

In real projects, usage gets a bit more complex:

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

This way, both the testability and extensibility of the code improve.

## Internal Principles

Here is a complete example:

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

Pay attention to edge-case handling — it's critical in production.

## Business Practice

The key is understanding the core logic:

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

Performance optimization has to be tied to the specific scenario — not every case calls for over-optimizing.

## Performance Comparison

Here's one way we can improve on this:

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

This approach has been running stably in production for over half a year and has proven itself in practice.

## Summary

- The code examples are for reference only and should be adapted to your actual use case
- `useReducer` for state management isn't a silver bullet — choose based on your project's scale and tech stack
- Understanding the underlying principles matters more than memorizing APIs
- Be sure to validate compatibility before using it in production
- In team collaboration, conventions and documentation matter more than the tech itself