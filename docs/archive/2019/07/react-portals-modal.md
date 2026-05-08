---
title: "React Portals 实现全局弹窗"
date: 2019-07-17 10:28:31
tags:
  - React
---

在团队推广React Portals 实现全局弹窗的过程中，踩了不少坑。整理出来希望对大家有所帮助。

## 核心原理

核心代码如下：

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

实际项目中还需要考虑边界条件和异常处理。

## 源码分析

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 实际应用

我们可以通过以下方式实现：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '张三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

注意上面代码中的性能细节，避免不必要的计算。

## 小结

- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
