---
title: "React Portals 實現全局彈窗"
date: 2019-07-17 10:28:31
tags:
  - React
readingTime: 1
description: "在團隊推廣React Portals 實現全局彈窗的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
wordCount: 207
---

在團隊推廣React Portals 實現全局彈窗的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 核心原理

核心代碼如下：

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

實際項目中還需要考慮邊界條件和異常處理。

## 源碼分析

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 實際應用

我們可以通過以下方式實現：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '張三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

注意上面代碼中的性能細節，避免不必要的計算。

## 小結

- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
