---
title: "前端 Code Review 要点"
date: 2019-06-27 16:43:22
tags:
  - 前端
---

团队最近在推 Code Review，整理了一份前端 CR 的检查清单。实际执行下来，不只是发现 bug，更是一种知识传递的方式。

## 代码风格一致性

风格不统一的代码读起来很痛苦。在 2019 年，ESLint + Prettier 的组合已经是标配了。

**项目根目录配置 ESLint**：

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'prettier' // 放最后，关闭与 Prettier 冲突的规则
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
    // React Hooks 规则（2019 年的新特性）
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // 常用规则
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

**配合编辑器自动格式化**（VS Code 配置）：

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

再加上 `husky` + `lint-staged`，确保提交前强制检查：

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

CR 时如果发现风格问题，第一反应应该是"为什么 lint 没拦住"，而不是手动逐个纠正。团队应该追求的是：**CR 不讨论格式，只讨论逻辑**。

## 命名规范

好命名是可读性的基础。CR 时重点关注：

**反面案例**：

```javascript
// 变量名看不出含义
const d = new Date()
const a = users.filter(u => u.a > 18)

// 函数名动词缺失
function userInfo(id) { /* 是获取还是设置？ */ }
function data(list) { /* 做了什么？ */ }

// 布尔值命名不直观
const status = checkLogin()  // status 是 true/false 还是状态字符串？
```

**正面案例**：

```javascript
const currentDate = new Date()
const adultUsers = users.filter(user => user.age > 18)

function getUserInfo(id) { /* 明确是获取 */ }
function normalizeData(rawList) { /* 明确是做归一化 */ }

const isLoggedIn = checkLogin()
const hasPermission = checkPermission(user, 'admin')
```

一些经验：
- 变量名用名词，函数名用动词开头
- 布尔值用 `is`/`has`/`can`/`should` 前缀
- 避免缩写，`btn` 不如 `button`，`cb` 不如 `callback`
- 数组用复数形式，`users` 比 `userList` 更自然
- 事件处理函数用 `handle` 或 `on` 前缀，保持一致

**命名一致性**：同一个概念在项目中应该用同一个词。比如"用户信息"要么全叫 `userInfo`，要么全叫 `userData`，不要混着用。

## 性能考量

CR 时需要留意常见的性能问题，尤其是渲染相关的。

**1. 避免在 render 中创建新对象/函数**

```jsx
{% raw %}
// 反面：每次 render 都创建新的 style 对象和新的回调函数
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

// 正面：提取常量，用 useCallback 包装回调
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

**2. 列表渲染必须有稳定的 key**

```jsx
// 反面：用 index 作为 key（数据变化时会导致不必要的重渲染）
{items.map((item, index) => (
  <ListItem key={index} data={item} />
))}

// 正面：用唯一标识符作为 key
{items.map(item => (
  <ListItem key={item.id} data={item} />
))}
```

**3. 图片懒加载**

```html
<!-- 2019 年原生懒加载还不成熟，需要用 IntersectionObserver -->
<img data-src="/images/hero.jpg" class="lazy" alt="Hero" />
```

```javascript
// 简单的图片懒加载实现
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

**4. 避免频繁的 DOM 操作**

```javascript
// 反面：循环中频繁操作 DOM
items.forEach(item => {
  const div = document.createElement('div')
  div.textContent = item.name
  container.appendChild(div)  // 每次 appendChild 都触发重排
})

// 正面：用 DocumentFragment 一次性插入
const fragment = document.createDocumentFragment()
items.forEach(item => {
  const div = document.createElement('div')
  div.textContent = item.name
  fragment.appendChild(div)
})
container.appendChild(fragment)  // 只触发一次重排
```

## 安全性检查

XSS 是前端最常见的安全问题，CR 时必须重点关注。

**1. 避免使用 dangerouslySetInnerHTML**

```jsx
{% raw %}
// 反面：直接插入用户输入的 HTML，XSS 风险极大
function Comment({ content }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />
}

// 正面：React 默认就会转义，直接渲染字符串即可
function Comment({ content }) {
  return <div>{content}</div>
}
{% endraw %}
```

如果确实需要渲染富文本（比如从后端返回的 HTML），务必先做白名单过滤：

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

**2. 避免在 URL 中拼接用户输入**

```javascript
// 反面：用户输入可能包含恶意字符
const url = `/api/search?q=${userInput}`

// 正面：使用 encodeURIComponent
const url = `/api/search?q=${encodeURIComponent(userInput)}`
```

**3. Cookie 安全**

```javascript
// 设置 Cookie 时加上安全属性
document.cookie = 'token=abc123; HttpOnly; Secure; SameSite=Strict'
```

`HttpOnly` 阻止 JS 读取 Cookie，`Secure` 限制只在 HTTPS 下发送，`SameSite` 防止 CSRF。

**4. Vue 中的 v-html 同样危险**

```html
{% raw %}
<!-- 反面：等同于 dangerouslySetInnerHTML -->
<div v-html="userInput"></div>

<!-- 正面：用模板语法自动转义 -->
<div>{{ userInput }}</div>
{% endraw %}
```

## 可访问性（Accessibility）

无障碍在国内项目中容易被忽视，但 CR 时应该养成检查的习惯。

```html
<!-- 反面：div 模拟按钮，屏幕阅读器无法识别 -->
<div class="btn" onclick="submitForm()">提交</div>

<!-- 正面：使用语义化标签 -->
<button type="button" onclick="submitForm()">提交</button>

<!-- 反面：图片没有 alt 文本 -->
<img src="chart.png" />

<!-- 正面：有意义的 alt 描述 -->
<img src="chart.png" alt="2019年Q2销售额趋势图，整体呈上升趋势" />

<!-- 表单关联 label -->
<label for="email">邮箱地址</label>
<input type="email" id="email" name="email" aria-describedby="email-hint" />
<span id="email-hint">请输入公司邮箱</span>
```

简单的检查清单：
- 所有可交互元素能否用键盘操作（Tab 切换、Enter/Space 触发）
- 图片是否有 `alt` 属性（装饰性图片用 `alt=""`）
- 表单控件是否关联了 `<label>`
- 颜色对比度是否足够（不只是靠颜色区分状态）

## 组件设计审查

CR 时看组件设计，重点关注**职责单一**和**可复用性**。

**反面案例：一个组件做太多事**

```jsx
// UserProfile.js：既获取数据，又处理业务逻辑，又渲染 UI
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

  if (loading) return <div>加载中...</div>

  const avatarUrl = user.avatar || '/default-avatar.png'
  const formattedDate = new Date(user.createdAt).toLocaleDateString('zh-CN')

  return (
    <div className="profile">
      <img src={avatarUrl} alt={user.name} />
      <h2>{user.name}</h2>
      <p>注册时间：{formattedDate}</p>
      <button onClick={() => window.location.href = `/chat/${user.id}`}>
        发消息
      </button>
    </div>
  )
}
```

**正面案例：拆分职责**

```jsx
// hooks/useUser.js —— 数据获取逻辑抽离
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

// components/UserProfile.js —— 纯 UI 组件
function UserProfile({ user }) {
  const avatarUrl = user.avatar || '/default-avatar.png'
  const formattedDate = new Date(user.createdAt).toLocaleDateString('zh-CN')

  return (
    <div className="profile">
      <img src={avatarUrl} alt={user.name} />
      <h2>{user.name}</h2>
      <p>注册时间：{formattedDate}</p>
    </div>
  )
}

// containers/UserProfileContainer.js —— 组装层
function UserProfileContainer({ userId }) {
  const { user, loading } = useUser(userId)

  if (loading) return <div>加载中...</div>

  const handleChat = () => {
    window.location.href = `/chat/${userId}`
  }

  return (
    <div>
      <UserProfile user={user} />
      <button onClick={handleChat}>发消息</button>
    </div>
  )
}
```

拆分后的好处：`UserProfile` 可以在任何地方复用，不需要关心数据从哪来；`useUser` hook 也可以被其他组件复用。

## 错误处理

这是 CR 中最常被遗漏的部分。没有错误处理的代码是定时炸弹。

**反面案例：网络请求没有错误处理**

```javascript
// fetch 不 catch 错误，接口挂了页面就白屏
async function loadData() {
  const res = await fetch('/api/data')
  const data = await res.json()
  renderList(data)
}

// try-catch 了但什么都没做
async function loadData() {
  try {
    const res = await fetch('/api/data')
    const data = await res.json()
    renderList(data)
  } catch (e) {
    // 默默吞掉错误，等于没处理
  }
}
```

**正面案例：合理的错误处理**

```javascript
async function loadData() {
  try {
    const res = await fetch('/api/data')

    if (!res.ok) {
      // fetch 不会对 4xx/5xx 抛错，需要手动检查
      throw new Error(`请求失败: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    renderList(data)
  } catch (error) {
    console.error('加载数据失败:', error)
    showErrorToast('数据加载失败，请稍后重试')
    renderEmptyState()
  }
}
```

**边界值和空数据的处理也要关注**：

```javascript
// 反面：假设 data 一定存在
function formatPrice(data) {
  return `¥${data.price.toFixed(2)}`
}

// 正面：做好防御
function formatPrice(data) {
  if (!data || typeof data.price !== 'number') {
    return '价格暂无'
  }
  return `¥${data.price.toFixed(2)}`
}
```

## 测试覆盖

CR 时看一下测试，不是要求 100% 覆盖率，但核心逻辑必须有测试。

```javascript
// 至少覆盖：正常路径、边界值、异常输入

describe('formatPrice', () => {
  it('should format price with two decimals', () => {
    expect(formatPrice({ price: 100 })).toBe('¥100.00')
  })

  it('should handle zero', () => {
    expect(formatPrice({ price: 0 })).toBe('¥0.00')
  })

  it('should return fallback when data is null', () => {
    expect(formatPrice(null)).toBe('价格暂无')
  })

  it('should return fallback when price is not a number', () => {
    expect(formatPrice({ price: 'abc' })).toBe('价格暂无')
  })
})
```

CR 时不需要通读测试代码，但可以问几个问题：
- 核心业务逻辑有没有测试？
- 有没有测试边界情况？
- mock 是否合理？（过度 mock 的测试价值不大）

## 常见反模式速查

CR 时遇到以下情况要特别留意：

```javascript
// 1. 深层嵌套回调（回调地狱）
getUser(id, (user) => {
  getOrders(user.id, (orders) => {
    getOrderDetails(orders[0].id, (details) => {
      // 还要嵌几层？
    })
  })
})

// 改成 async/await
const user = await getUser(id)
const orders = await getOrders(user.id)
const details = await getOrderDetails(orders[0].id)

// 2. 巨型函数（超过 50 行就要考虑拆分）
function handleFormSubmit() {
  // 200 行代码...
}

// 3. 魔法数字
if (status === 2) { /* 2 是什么？ */ }

// 改为枚举/常量
const OrderStatus = {
  PENDING: 0,
  PAID: 1,
  SHIPPED: 2,
  COMPLETED: 3
}
if (status === OrderStatus.SHIPPED) { /* 语义明确 */ }

// 4. 过早优化
// 没有性能问题就不要写复杂的缓存逻辑

// 5. 注释掉的代码
// const oldFunction = () => { ... }
// 直接删掉，git 历史会帮你记住

// 6. 全局变量污染
window.myGlobalConfig = { /* ... */ }
// 改为模块导出
export const config = { /* ... */ }

// 7. 条件渲染过深
{a && b && c && d && <Component />}
// 改为提前 return 或提取子组件

// 8. 重复代码（违反 DRY 原则）
function getAdminUsers(users) {
  return users.filter(u => u.role === 'admin' && u.isActive)
}
function getActiveEditors(users) {
  return users.filter(u => u.role === 'editor' && u.isActive)
}
// 抽取通用过滤逻辑
function filterUsers(users, predicate) {
  return users.filter(u => u.isActive && predicate(u))
}
const adminUsers = filterUsers(users, u => u.role === 'admin')
const activeEditors = filterUsers(users, u => u.role === 'editor')
```

## 小结

- 代码风格交给 ESLint + Prettier 自动化，CR 不应该花时间在格式问题上
- 关注命名：变量名是名词，函数名是动词开头，布尔值用 is/has/can/should
- 性能重点看渲染相关：避免 render 中创建新引用、列表 key 要稳定
- 安全性第一防线是 XSS，坚决杜绝 dangerouslySetInnerHTML / v-html 插入未经处理的用户输入
- 组件设计遵循单一职责，数据获取、业务逻辑、UI 渲染应该分离
- 错误处理不是可选项，每个网络请求和异步操作都必须有兜底方案
- 测试覆盖核心逻辑即可，但边界情况和异常输入不能遗漏
