---
title: "React 22 Server Actions 進階：表單處理與資料變異模式"
date: 2026-06-25 18:31:50
tags:
  - React
readingTime: 2
description: "Server Actions 已經成為 React 應用中資料變異的標準方式。本文深入探討 Server Actions 在複雜表單處理中的應用模式和最佳實踐。"
wordCount: 227
---

React 22 的 Server Actions 已經從新特性變成構建現代 React 應用的核心能力。它改變了前端與後端互動的方式——不再需要手動撰寫 API 端點和 fetch 呼叫，Server Actions 讓資料變異變得更加直觀。

## Server Actions 基礎

Server Actions 是標記為 `use server` 的非同步函數，可以在客戶端元件中直接呼叫：

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
  
  revalidatePath('/Users')
  return { success: true, user }
}
```

### 客戶端呼叫

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
      {state?.success && <p>使用者建立成功！</p>}
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

## 效能最佳化

### 批次操作

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
  
  revalidatePath('/Users')
  return { success: true, updated: updates.length }
}
```

## 小結

React 22 的 Server Actions 徹底改變了前端與後端的互動方式。透過 `useActionState`、`useOptimistic` 和 `useTransition` 等 Hook，可以構建出響應迅速、錯誤處理完善的現代表單。關鍵在於理解 Server Actions 的適用場景——它適合資料變異操作，而資料取得仍然應該使用 Server Components 和資料取得模式。
