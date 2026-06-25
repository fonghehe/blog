---
title: "React 22 Server Actions 進階：表單處理與數據變異模式"
date: 2026-06-25 18:31:50
tags:
  - React
readingTime: 2
description: "Server Actions 已經成為 React 應用中數據變異的標準方式。本文深入探討 Server Actions 在複雜表單處理中的應用模式和最佳實踐。"
wordCount: 225
---

React 22 的 Server Actions 已經從新特性變成構建現代 React 應用的核心能力。它改變了前端與後端交互的方式——不再需要手動編寫 API 端點和 fetch 調用，Server Actions 讓數據變異變得更加直觀。

## Server Actions 基礎

Server Actions 是標記為 `use server` 的異步函數，可以在客戶端組件中直接調用：

```typescript
// actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  
  const user = await db.user.create({
    data: { name, email }
  })
  
  revalidatePath('/users')
  return { success: true, user }
}
```

### 客戶端調用

```typescript
'use client'

import { createUser } from './actions'

function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, null)
  
  return (
    <form action={formAction}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
      {state?.success && <p>用戶創建成功！</p>}
    </form>
  )
}
```

## 複雜表單處理模式

### 多步驟表單

```typescript
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
      
      await db.user.create({ data: fullData })
      return { step: 3, data: fullData, errors: {} }
    
    default:
      return prevState
  }
}
```

### 樂觀 UI 更新

```typescript
'use client'

import { useOptimistic } from 'react'
import { addTodo } from './actions'

function TodoList({ initialTodos }) {
  const [todos, setOptimisticTodos] = useOptimistic(
    initialTodos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }]
  )
  
  async function handleSubmit(formData) {
    const text = formData.get('text') as string
    
    const optimisticTodo = { id: 'temp', text, pending: true }
    setOptimisticTodos(optimisticTodo)
    
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

## 性能優化

### 批量操作

```typescript
'use server'

export async function batchUpdateUsers(prevState, formData) {
  const updates = JSON.parse(formData.get('updates') as string)
  
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
```

## 總結

React 22 的 Server Actions 徹底改變了前端與後端的交互方式。通過 `useActionState`、`useOptimistic` 和 `useTransition` 等 Hook，可以構建出響應迅速、錯誤處理完善的現代表單。關鍵在於理解 Server Actions 的適用場景——它適合數據變異操作，而數據獲取仍然應該使用 Server Components 和數據獲取模式。
