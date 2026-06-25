---
title: "React 22 Server Actions 进阶：表单处理与数据突变的模式"
date: 2026-06-25 18:31:50
tags:
  - React
readingTime: 4
description: "Server Actions 已经成为 React 应用中数据突变的标准方式。本文深入探讨 Server Actions 在复杂表单处理中的应用模式和最佳实践。"
wordCount: 381
---

React 22 的 Server Actions 已经从新特性变成构建现代 React 应用的核心能力。它改变了前端与后端交互的方式——不再需要手动编写 API 端点和 fetch 调用，Server Actions 让数据突变变得更加直观。

## Server Actions 基础

Server Actions 是标记为 `use server` 的异步函数，可以在客户端组件中直接调用：

```typescript
// actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  
  // 服务端逻辑
  const user = await db.user.create({
    data: { name, email }
  })
  
  // 重新验证缓存
  revalidatePath('/users')
  
  return { success: true, user }
}

export async function updateUser(id: string, formData: FormData) {
  const name = formData.get('name') as string
  
  await db.user.update({
    where: { id },
    data: { name }
  })
  
  revalidatePath(`/users/${id}`)
  return { success: true }
}
```

### 客户端调用

```typescript
'use client'

import { createUser, updateUser } from './actions'

function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, null)
  
  return (
    <form action={formAction}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
      {state?.success && <p>User created successfully!</p>}
    </form>
  )
}
```

## 复杂表单处理模式

### 多步骤表单

```typescript
// actions.ts
'use server'

interface WizardState {
  step: number
  data: Partial<FormData>
  errors: Record<string, string>
}

export async function wizardAction(
  prevState: WizardState,
  formData: FormData
): Promise<WizardState> {
  const action = formData.get('_action') as string
  
  switch (action) {
    case 'next':
      const step1Data = {
        name: formData.get('name') as string,
        email: formData.get('email') as string
      }
      
      // 验证第一步数据
      const errors1 = validateStep1(step1Data)
      if (Object.keys(errors1).length > 0) {
        return { step: 1, data: step1Data, errors: errors1 }
      }
      
      return { step: 2, data: step1Data, errors: {} }
    
    case 'submit':
      const fullData = {
        ...prevState.data,
        address: formData.get('address') as string,
        city: formData.get('city') as string
      }
      
      // 创建用户
      await db.user.create({ data: fullData })
      
      return { step: 3, data: fullData, errors: {} }
    
    default:
      return prevState
  }
}

// 多步骤表单组件
'use client'

function WizardForm() {
  const [state, formAction, isPending] = useActionState(wizardAction, {
    step: 1,
    data: {},
    errors: {}
  })
  
  return (
    <form action={formAction}>
      {state.step === 1 && (
        <>
          <input name="name" defaultValue={state.data.name} />
          {state.errors.name && <span>{state.errors.name}</span>}
          <input name="email" defaultValue={state.data.email} />
          <input type="hidden" name="_action" value="next" />
          <button type="submit">Next</button>
        </>
      )}
      
      {state.step === 2 && (
        <>
          <input name="address" defaultValue={state.data.address} />
          <input name="city" defaultValue={state.data.city} />
          <input type="hidden" name="_action" value="submit" />
          <button type="submit" disabled={isPending}>
            {isPending ? 'Submitting...' : 'Submit'}
          </button>
        </>
      )}
      
      {state.step === 3 && (
        <div>
          <h3>Success!</h3>
          <p>User created successfully.</p>
        </div>
      )}
    </form>
  )
}
```

### 动态表单验证

```typescript
// actions.ts
'use server'

export async function validateEmail(
  prevState: any,
  formData: FormData
) {
  const email = formData.get('email') as string
  
  // 检查邮箱是否已存在
  const existingUser = await db.user.findUnique({
    where: { email }
  })
  
  if (existingUser) {
    return { valid: false, error: 'Email already exists' }
  }
  
  // 检查邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  return { valid: true, error: null }
}

// 带实时验证的表单
'use client'

function RegistrationForm() {
  const [emailState, emailAction, isEmailPending] = useActionState(
    validateEmail,
    { valid: null, error: null }
  )
  
  return (
    <form>
      <input
        name="email"
        type="email"
        onBlur={() => {
          // 触发邮箱验证
          emailAction(new FormData(e.target.form))
        }}
      />
      {isEmailPending && <span>Checking...</span>}
      {emailState.valid === false && (
        <span className="error">{emailState.error}</span>
      )}
      {emailState.valid === true && (
        <span className="success">Email available!</span>
      )}
    </form>
  )
}
```

## 乐观更新模式

### 乐观 UI 更新

```typescript
'use client'

import { useOptimistic } from 'react'
import { addTodo } from './actions'

function TodoList({ initialTodos }) {
  const [todos, setOptimisticTodos] = useOptimistic(
    initialTodos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }]
  )
  
  async function handleSubmit(formData: FormData) {
    const text = formData.get('text') as string
    
    // 乐观更新：立即显示新 todo
    const optimisticTodo = { id: 'temp', text, pending: true }
    setOptimisticTodos(optimisticTodo)
    
    // 服务端操作
    await addTodo(formData)
  }
  
  return (
    <div>
      <form action={handleSubmit}>
        <input name="text" required />
        <button type="submit">Add</button>
      </form>
      
      <ul>
        {todos.map(todo => (
          <li key={todo.id} className={todo.pending ? 'pending' : ''}>
            {todo.text}
            {todo.pending && <span>Saving...</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 使用 `useTransition` 优化

```typescript
'use client'

import { useTransition } from 'react'
import { deleteTodo } from './actions'

function TodoItem({ todo, onDelete }) {
  const [isPending, startTransition] = useTransition()
  
  function handleDelete() {
    startTransition(async () => {
      await deleteTodo(todo.id)
    })
  }
  
  return (
    <li className={isPending ? 'deleting' : ''}>
      <span>{todo.text}</span>
      <button onClick={handleDelete} disabled={isPending}>
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
    </li>
  )
}
```

## 错误处理策略

### 全局错误边界

```typescript
// error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}

// actions.ts 中的错误处理
'use server'

export async function createOrder(formData: FormData) {
  try {
    const items = JSON.parse(formData.get('items') as string)
    
    // 验证库存
    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId }
      })
      
      if (!product || product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product?.name}`)
      }
    }
    
    // 创建订单
    const order = await db.order.create({
      data: {
        items,
        total: calculateTotal(items)
      }
    })
    
    return { success: true, orderId: order.id }
  } catch (error) {
    // 返回结构化错误
    return {
      success: false,
      error: error.message || 'Failed to create order'
    }
  }
}
```

### 表单级别的错误处理

```typescript
'use client'

function CheckoutForm() {
  const [state, formAction, isPending] = useActionState(createOrder, null)
  
  return (
    <form action={formAction}>
      {/* 表单字段 */}
      
      {state?.error && (
        <div className="form-error">
          <p>{state.error}</p>
        </div>
      )}
      
      {state?.success && (
        <div className="form-success">
          <p>Order created! ID: {state.orderId}</p>
        </div>
      )}
      
      <button type="submit" disabled={isPending}>
        {isPending ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  )
}
```

## 性能优化

### 批量操作

```typescript
// actions.ts
'use server'

export async function batchUpdateUsers(
  prevState: any,
  formData: FormData
) {
  const updates = JSON.parse(formData.get('updates') as string)
  
  // 使用事务批量更新
  await db.$transaction(
    updates.map(update => 
      db.user.update({
        where: { id: update.id },
        data: update.data
      })
    )
  )
  
  revalidatePath('/users')
  return { success: true, updated: updates.length }
}

// 客户端批量操作
'use client'

function BulkUserEditor({ users }) {
  const [state, formAction, isPending] = useActionState(batchUpdateUsers, null)
  
  async function handleSubmit(selectedUsers, updates) {
    const formData = new FormData()
    formData.append('updates', JSON.stringify(
      selectedUsers.map(user => ({
        id: user.id,
        data: updates
      }))
    ))
    
    formAction(formData)
  }
  
  return (
    <form action={formAction}>
      {/* 用户选择和编辑 UI */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Updating...' : 'Update Selected Users'}
      </button>
    </form>
  )
}
```

### 缓存策略

```typescript
// actions.ts
'use server'

import { unstable_cache } from 'next/cache'

// 缓存数据库查询
const getUser = unstable_cache(
  async (id: string) => {
    return db.user.findUnique({
      where: { id },
      include: { posts: true }
    })
  },
  ['user'],
  { revalidate: 3600 }  // 1 小时缓存
)

export async function updateUserProfile(
  prevState: any,
  formData: FormData
) {
  const userId = formData.get('userId') as string
  const name = formData.get('name') as string
  
  await db.user.update({
    where: { id: userId },
    data: { name }
  })
  
  // 清除相关缓存
  revalidatePath(`/users/${userId}`)
  revalidatePath('/users')
  
  return { success: true }
}
```

## 最佳实践总结

1. **使用 `useActionState` 处理表单状态**：自动管理 loading 和 error 状态
2. **乐观更新提升用户体验**：在等待服务端响应时立即更新 UI
3. **结构化错误处理**：返回明确的错误信息，而不是抛出异常
4. **批量操作优化性能**：减少网络请求次数
5. **合理使用缓存**：避免不必要的数据库查询

## 小结

React 22 的 Server Actions 彻底改变了前端与后端的交互方式。通过 `useActionState`、`useOptimistic` 和 `useTransition` 等 Hook，可以构建出响应迅速、错误处理完善的现代表单。关键在于理解 Server Actions 的适用场景——它适合数据突变操作，而数据获取仍然应该使用 Server Components 和数据获取模式。
