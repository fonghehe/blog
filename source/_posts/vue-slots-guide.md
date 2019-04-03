---
title: "Vue 2 插槽 slot 完全指南"
date: 2019-04-03 15:05:23
tags:
  - Vue
---

Vue 2 插槽 slot 完全指南是日常开发中经常遇到的问题。本文从实际项目出发，分享具体的实现方法和经验总结。

## 基础用法

先来看基本的用法：

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

这种写法简洁明了，适合大多数场景。

## 进阶技巧

核心代码如下：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '张三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

实际项目中还需要考虑边界条件和异常处理。

## 实战案例

下面是一个实际的例子：

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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 注意事项

我们可以通过以下方式实现：

```javascript
:root {
  --primary: #3498db;
  --bg: #fff;
  --text: #333;
}

[data-theme='dark'] {
  --primary: #5dade2;
  --bg: #1a1a2e;
  --text: #eee;
}

body {
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}
```

注意上面代码中的性能细节，避免不必要的计算。

## 小结

- Vue 2 插槽 slot 完全指南的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
