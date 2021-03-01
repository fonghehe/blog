---
title: "Node.js 错误处理最佳实践"
date: 2019-04-15 11:14:06
tags:
  - Node.js
---

关于Node.js 错误处理最佳实践，网上有不少文章但大多缺乏实战经验。本文结合真实项目，探讨最佳实践。

## 快速上手

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 高级用法

我们可以通过以下方式实现：

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

注意上面代码中的性能细节，避免不必要的计算。

## 业务场景

具体实现参考以下代码：

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

经过线上验证，这套方案运行稳定。

## 避坑指南

先来看基本的用法：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '张三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

这种写法简洁明了，适合大多数场景。

## 快速上手

核心代码如下：

```javascript
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-gap: 1.5rem;
}

.grid__item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.grid__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
```

实际项目中还需要考虑边界条件和异常处理。

## 小结

- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
