---
title: "Vue 2 Transition and Animation System"
date: 2019-09-06 10:53:29
tags:
  - Vue
readingTime: 1
description: "最近项目中用到了Vue 2 过渡与动画系统，发现比预想的要复杂。分享一下实践过程中总结的经验。"
wordCount: 223
---

最近项目中用到了Vue 2 过渡与动画系统，发现比预想的要复杂。分享一下实践过程中总结的经验。

## Quick Start

具体实现参考以下代码：

```css
function pLimit(concurrency) {
  const queue = []
  let active = 0

  const next = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    fn().then(resolve, reject).finally(() => {
      active--
      next()
    })
  }

  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    next()
  })
}
```

经过线上验证，这套方案运行稳定。

## Advanced Usage

先来看基本的用法：

```css
class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    const handlers = this.events.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  emit(event, ...args) {
    const handlers = this.events.get(event) || []
    handlers.forEach(h => h(...args))
  }
}
```

这种写法简洁明了，适合大多数场景。

## Business Scenarios

核心代码如下：

```css
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
}

function createUser(data: Partial<User>): User {
  return {
    id: Date.now(),
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'user'
  }
}

type UserKeys = keyof User  // 'id' | 'name' | 'email' | 'role'
```

实际项目中还需要考虑边界条件和异常处理。

## Pitfall Avoidance Guide

下面是一个实际的例子：

```css
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '张三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

这种模式在团队中推广后效果很好，维护成本明显降低。

## Summary

- 遇到问题多看源码和官方文档
- Vue 2 过渡与动画系统的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
