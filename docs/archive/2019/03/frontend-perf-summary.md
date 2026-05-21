---
title: "前端性能优化手段汇总"
date: 2019-03-11 10:41:26
tags:
  - 前端
readingTime: 1
description: "在团队推广前端性能优化手段汇总的过程中，踩了不少坑。整理出来希望对大家有所帮助。"
wordCount: 226
---

在团队推广前端性能优化手段汇总的过程中，踩了不少坑。整理出来希望对大家有所帮助。

## 快速上手

核心代码如下：

```javascript
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

实际项目中还需要考虑边界条件和异常处理。

## 高级用法

下面是一个实际的例子：

```javascript
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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 业务场景

我们可以通过以下方式实现：

```javascript
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

注意上面代码中的性能细节，避免不必要的计算。

## 避坑指南

具体实现参考以下代码：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '张三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

经过线上验证，这套方案运行稳定。

## 小结

- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
