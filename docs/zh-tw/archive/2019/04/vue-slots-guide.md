---
title: "Vue 2 插槽 slot 完全指南"
date: 2019-04-03 15:05:23
tags:
  - Vue
readingTime: 1
description: "Vue 2 插槽 slot 完全指南是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。"
wordCount: 250
---

Vue 2 插槽 slot 完全指南是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。

## 基礎用法

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 進階技巧

核心程式碼如下：

```javascript
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: '張三', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

實際專案中還需要考慮邊界條件和異常處理。

## 實戰案例

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 注意事項

我們可以通過以下方式實現：

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

注意上面程式碼中的效能細節，避免不必要的計算。

## 小結

- Vue 2 插槽 slot 完全指南的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
