---
title: "前端 Code Review 要點"
date: 2019-06-27 16:43:22
tags:
  - 前端
readingTime: 7
description: "團隊最近在推 Code Review，整理了一份前端 CR 的檢查清單。實際執行下來，不只是發現 bug，更是一種知識傳遞的方式。"
---

團隊最近在推 Code Review，整理了一份前端 CR 的檢查清單。實際執行下來，不只是發現 bug，更是一種知識傳遞的方式。

## 程式碼風格一致性

風格不統一的程式碼讀起來很痛苦。在 2019 年，ESLint + Prettier 的組合已經是標配了。

**專案根目錄配置 ESLint**：

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'prettier' // 放最後，關閉與 Prettier 衝突的規則
  ],
  plugins: ['react', 'react-hooks'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  env: {
    browser: true,
    node: true,
    jest: true,
    es6: true
  },
  rules: {
    // React Hooks 規則（2019 年的新特性）
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // 常用規則
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always']
  }
};
```

**Prettier 配置**：

```json
// .prettierrc
{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**配合編輯器自動格式化**（VS Code 配置）：

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

再加上 `husky` + `lint-staged`，確保提交前強制檢查：

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx}": [
      "eslint --fix",
      "git add"
    ],
    "*.{js,jsx,json,css,md}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

CR 時如果發現風格問題，第一反應應該是"為什麼 lint 沒攔住"，而不是手動逐個糾正。團隊應該追求的是：**CR 不討論格式，只討論邏輯**。

## 命名規範

好命名是可讀性的基礎。CR 時重點關注：

**反面案例**：

```javascript
// 變數名看不出含義
const d = new Date()
const a = users.filter(u => u.a > 18)

// 函式名動詞缺失
function userInfo(id) { /* 是獲取還是設定？ */ }
function data(list) { /* 做了什麼？ */ }

// 布林值命名不直觀
const status = checkLogin()  // status 是 true/false 還是狀態字串？
```

**正面案例**：

```javascript
const currentDate = new Date()
const adultUsers = users.filter(user => user.age > 18)

function getUserInfo(id) { /* 明確是獲取 */ }
function normalizeData(rawList) { /* 明確是做歸一化 */ }

const isLoggedIn = checkLogin()
const hasPermission = checkPermission(user, 'admin')
```

一些經驗：
- 變數名用名詞，函式名用動詞開頭
- 布林值用 `is`/`has`/`can`/`should` 字首
- 避免縮寫，`btn` 不如 `button`，`cb` 不如 `callback`
- 陣列用複數形式，`users` 比 `userList` 更自然
- 事件處理函式用 `handle` 或 `on` 字首，保持一致

**命名一致性**：同一個概念在專案中應該用同一個詞。比如"使用者資訊"要麼全叫 `userInfo`，要麼全叫 `userData`，不要混著用。

## 效能考量

CR 時需要留意常見的效能問題，尤其是渲染相關的。

**1. 避免在 render 中建立新物件/函式**

```jsx
{% raw %}
// 反面：每次 render 都建立新的 style 物件和新的回撥函式
function UserList({ users }) {
  return (
    <div style={{ padding: 16 }}>
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          onClick={() => handleClick(user.id)}
        />
      ))}
    </div>
  )
}

// 正面：提取常量，用 useCallback 包裝回調
const containerStyle = { padding: 16 }

function UserList({ users }) {
  const handleClick = useCallback((id) => {
    console.log('clicked user:', id)
  }, [])

  return (
    <div style={containerStyle}>
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          onClick={handleClick}
        />
      ))}
    </div>
  )
}
{% endraw %}
```

**2. 列表渲染必須有穩定的 key**

```jsx
// 反面：用 index 作為 key（資料變化時會導致不必要的重渲染）
{items.map((item, index) => (
  <ListItem key={index} data={item} />
))}

// 正面：用唯一識別符號作為 key
{items.map(item => (
  <ListItem key={item.id} data={item} />
))}
```

**3. 圖片懶載入**

```html
<!-- 2019 年原生懶載入還不成熟，需要用 IntersectionObserver -->
<img data-src="/images/hero.jpg" class="lazy" alt="Hero" />
```

```javascript
// 簡單的圖片懶載入實現
const lazyImages = document.querySelectorAll('.lazy')
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target
      img.src = img.dataset.src
      img.classList.remove('lazy')
      observer.unobserve(img)
    }
  })
})

lazyImages.forEach(img => observer.observe(img))
```

**4. 避免頻繁的 DOM 操作**

```javascript
// 反面：迴圈中頻繁操作 DOM
items.forEach(item => {
  const div = document.createElement('div')
  div.textContent = item.name
  container.appendChild(div)  // 每次 appendChild 都觸發重排
})

// 正面：用 DocumentFragment 一次性插入
const fragment = document.createDocumentFragment()
items.forEach(item => {
  const div = document.createElement('div')
  div.textContent = item.name
  fragment.appendChild(div)
})
container.appendChild(fragment)  // 只觸發一次重排
```

## 安全性檢查

XSS 是前端最常見的安全問題，CR 時必須重點關注。

**1. 避免使用 dangerouslySetInnerHTML**

```jsx
{% raw %}
// 反面：直接插入使用者輸入的 HTML，XSS 風險極大
function Comment({ content }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />
}

// 正面：React 預設就會轉義，直接渲染字串即可
function Comment({ content }) {
  return <div>{content}</div>
}
{% endraw %}
```

如果確實需要渲染富文本（比如從後端返回的 HTML），務必先做白名單過濾：

```javascript
{% raw %}
import sanitizeHtml from 'sanitize-html'

function RichContent({ html }) {
  const cleanHtml = sanitizeHtml(html, {
    allowedTags: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
    allowedAttributes: {
      'a': ['href', 'target', 'rel']
    }
  })
  return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
}
{% endraw %}
```

**2. 避免在 URL 中拼接使用者輸入**

```javascript
// 反面：使用者輸入可能包含惡意字元
const url = `/api/search?q=${userInput}`

// 正面：使用 encodeURIComponent
const url = `/api/search?q=${encodeURIComponent(userInput)}`
```

**3. Cookie 安全**

```javascript
// 設定 Cookie 時加上安全屬性
document.cookie = 'token=abc123; HttpOnly; Secure; SameSite=Strict'
```

`HttpOnly` 阻止 JS 讀取 Cookie，`Secure` 限制只在 HTTPS 下發送，`SameSite` 防止 CSRF。

**4. Vue 中的 v-html 同樣危險**

```html
{% raw %}
<!-- 反面：等同於 dangerouslySetInnerHTML -->
<div v-html="userInput"></div>

<!-- 正面：用模板語法自動轉義 -->
<div>{{ userInput }}</div>
{% endraw %}
```

## 可訪問性（Accessibility）

無障礙在國內專案中容易被忽視，但 CR 時應該養成檢查的習慣。

```html
<!-- 反面：div 模擬按鈕，螢幕閱讀器無法識別 -->
<div class="btn" onclick="submitForm()">提交</div>

<!-- 正面：使用語義化標籤 -->
<button type="button" onclick="submitForm()">提交</button>

<!-- 反面：圖片沒有 alt 文本 -->
<img src="chart.png" />

<!-- 正面：有意義的 alt 描述 -->
<img src="chart.png" alt="2019年Q2銷售額趨勢圖，整體呈上升趨勢" />

<!-- 表單關聯 label -->
<label for="email">郵箱地址</label>
<input type="email" id="email" name="email" aria-describedby="email-hint" />
<span id="email-hint">請輸入公司郵箱</span>
```

簡單的檢查清單：
- 所有可互動元素能否用鍵盤操作（Tab 切換、Enter/Space 觸發）
- 圖片是否有 `alt` 屬性（裝飾性圖片用 `alt=""`）
- 表單控制元件是否關聯了 `<label>`
- 顏色對比度是否足夠（不只是靠顏色區分狀態）

## 元件設計審查

CR 時看元件設計，重點關注**職責單一**和**可複用性**。

**反面案例：一個元件做太多事**

```jsx
// UserProfile.js：既獲取資料，又處理業務邏輯，又渲染 UI
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data)
        setLoading(false)
      })
  }, [userId])

  if (loading) return <div>載入中...</div>

  const avatarUrl = user.avatar || '/default-avatar.png'
  const formattedDate = new Date(user.createdAt).toLocaleDateString('zh-CN')

  return (
    <div className="profile">
      <img src={avatarUrl} alt={user.name} />
      <h2>{user.name}</h2>
      <p>註冊時間：{formattedDate}</p>
      <button onClick={() => window.location.href = `/chat/${user.id}`}>
        發訊息
      </button>
    </div>
  )
}
```

**正面案例：拆分職責**

```jsx
// hooks/useUser.js —— 資料獲取邏輯抽離
function useUser(userId) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setUser(data)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [userId])

  return { user, loading }
}

// components/UserProfile.js —— 純 UI 元件
function UserProfile({ user }) {
  const avatarUrl = user.avatar || '/default-avatar.png'
  const formattedDate = new Date(user.createdAt).toLocaleDateString('zh-CN')

  return (
    <div className="profile">
      <img src={avatarUrl} alt={user.name} />
      <h2>{user.name}</h2>
      <p>註冊時間：{formattedDate}</p>
    </div>
  )
}

// containers/UserProfileContainer.js —— 組裝層
function UserProfileContainer({ userId }) {
  const { user, loading } = useUser(userId)

  if (loading) return <div>載入中...</div>

  const handleChat = () => {
    window.location.href = `/chat/${userId}`
  }

  return (
    <div>
      <UserProfile user={user} />
      <button onClick={handleChat}>發訊息</button>
    </div>
  )
}
```

拆分後的好處：`UserProfile` 可以在任何地方複用，不需要關心資料從哪來；`useUser` hook 也可以被其他元件複用。

## 錯誤處理

這是 CR 中最常被遺漏的部分。沒有錯誤處理的程式碼是定時炸彈。

**反面案例：網路請求沒有錯誤處理**

```javascript
// fetch 不 catch 錯誤，介面掛了頁面就白屏
async function loadData() {
  const res = await fetch('/api/data')
  const data = await res.json()
  renderList(data)
}

// try-catch 了但什麼都沒做
async function loadData() {
  try {
    const res = await fetch('/api/data')
    const data = await res.json()
    renderList(data)
  } catch (e) {
    // 默默吞掉錯誤，等於沒處理
  }
}
```

**正面案例：合理的錯誤處理**

```javascript
async function loadData() {
  try {
    const res = await fetch('/api/data')

    if (!res.ok) {
      // fetch 不會對 4xx/5xx 拋錯，需要手動檢查
      throw new Error(`請求失敗: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    renderList(data)
  } catch (error) {
    console.error('載入資料失敗:', error)
    showErrorToast('資料載入失敗，請稍後重試')
    renderEmptyState()
  }
}
```

**邊界值和空資料的處理也要關注**：

```javascript
// 反面：假設 data 一定存在
function formatPrice(data) {
  return `¥${data.price.toFixed(2)}`
}

// 正面：做好防禦
function formatPrice(data) {
  if (!data || typeof data.price !== 'number') {
    return '價格暫無'
  }
  return `¥${data.price.toFixed(2)}`
}
```

## 測試覆蓋

CR 時看一下測試，不是要求 100% 覆蓋率，但核心邏輯必須有測試。

```javascript
// 至少覆蓋：正常路徑、邊界值、異常輸入

describe('formatPrice', () => {
  it('should format price with two decimals', () => {
    expect(formatPrice({ price: 100 })).toBe('¥100.00')
  })

  it('should handle zero', () => {
    expect(formatPrice({ price: 0 })).toBe('¥0.00')
  })

  it('should return fallback when data is null', () => {
    expect(formatPrice(null)).toBe('價格暫無')
  })

  it('should return fallback when price is not a number', () => {
    expect(formatPrice({ price: 'abc' })).toBe('價格暫無')
  })
})
```

CR 時不需要通讀測試程式碼，但可以問幾個問題：
- 核心業務邏輯有沒有測試？
- 有沒有測試邊界情況？
- mock 是否合理？（過度 mock 的測試價值不大）

## 常見反模式速查

CR 時遇到以下情況要特別留意：

```javascript
// 1. 深層巢狀回撥（回撥地獄）
getUser(id, (user) => {
  getOrders(user.id, (orders) => {
    getOrderDetails(orders[0].id, (details) => {
      // 還要嵌幾層？
    })
  })
})

// 改成 async/await
const user = await getUser(id)
const orders = await getOrders(user.id)
const details = await getOrderDetails(orders[0].id)

// 2. 巨型函式（超過 50 行就要考慮拆分）
function handleFormSubmit() {
  // 200 行程式碼...
}

// 3. 魔法數字
if (status === 2) { /* 2 是什麼？ */ }

// 改為列舉/常量
const OrderStatus = {
  PENDING: 0,
  PAID: 1,
  SHIPPED: 2,
  COMPLETED: 3
}
if (status === OrderStatus.SHIPPED) { /* 語義明確 */ }

// 4. 過早最佳化
// 沒有效能問題就不要寫複雜的快取邏輯

// 5. 註釋掉的程式碼
// const oldFunction = () => { ... }
// 直接刪掉，git 歷史會幫你記住

// 6. 全域性變數汙染
window.myGlobalConfig = { /* ... */ }
// 改為模組匯出
export const config = { /* ... */ }

// 7. 條件渲染過深
{a && b && c && d && <Component />}
// 改為提前 return 或提取子元件

// 8. 重複程式碼（違反 DRY 原則）
function getAdminUsers(users) {
  return users.filter(u => u.role === 'admin' && u.isActive)
}
function getActiveEditors(users) {
  return users.filter(u => u.role === 'editor' && u.isActive)
}
// 抽取通用過濾邏輯
function filterUsers(users, predicate) {
  return users.filter(u => u.isActive && predicate(u))
}
const adminUsers = filterUsers(users, u => u.role === 'admin')
const activeEditors = filterUsers(users, u => u.role === 'editor')
```

## 小結

- 程式碼風格交給 ESLint + Prettier 自動化，CR 不應該花時間在格式問題上
- 關注命名：變數名是名詞，函式名是動詞開頭，布林值用 is/has/can/should
- 效能重點看渲染相關：避免 render 中建立新引用、列表 key 要穩定
- 安全性第一防線是 XSS，堅決杜絕 dangerouslySetInnerHTML / v-html 插入未經處理的使用者輸入
- 元件設計遵循單一職責，資料獲取、業務邏輯、UI 渲染應該分離
- 錯誤處理不是可選項，每個網路請求和非同步操作都必須有兜底方案
- 測試覆蓋核心邏輯即可，但邊界情況和異常輸入不能遺漏
