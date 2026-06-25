---
title: "React 22 Server Actions Advanced: Form Handling and Data Mutation Patterns"
date: 2026-06-25 18:31:50
tags:
  - React
readingTime: 2
description: "Server Actions have become the standard for data mutations in React applications. This article explores Server Actions application patterns and best practices in complex form handling."
wordCount: 126
---

React 22's Server Actions have evolved from a new feature to a core capability for building modern React applications. They change how frontend interacts with backend—no longer requiring manual API endpoint and fetch call writing, Server Actions make data mutations more intuitive.

## Server Actions Basics

Server Actions are async functions marked with `use server`, callable directly in client components:

```typescript
// actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  
  // Server-side logic
  const user = await db.user.create({
    data: { name, email }
  })
  
  // Revalidate cache
  revalidatePath('/users')
  
  return { success: true, user }
}
```

### Client-side Calling

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
      {state?.success && <p>User created successfully!</p>}
    </form>
  )
}
```

## Complex Form Handling Patterns

### Multi-step Forms

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
      
      // Validate step 1 data
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
      
      // Create user
      await db.user.create({ data: fullData })
      
      return { step: 3, data: fullData, errors: {} }
    
    default:
      return prevState
  }
}
```

### Optimistic UI Updates

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
    
    // Optimistic update: immediately show new todo
    const optimisticTodo = { id: 'temp', text, pending: true }
    setOptimisticTodos(optimisticTodo)
    
    // Server operation
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

## Error Handling Strategy

### Server-side Error Handling

```typescript
// actions.ts
'use server'

export async function createOrder(formData: FormData) {
  try {
    const items = JSON.parse(formData.get('items') as string)
    
    // Validate inventory
    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId }
      })
      
      if (!product || product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product?.name}`)
      }
    }
    
    // Create order
    const order = await db.order.create({
      data: {
        items,
        total: calculateTotal(items)
      }
    })
    
    return { success: true, orderId: order.id }
  } catch (error) {
    // Return structured error
    return {
      success: false,
      error: error.message || 'Failed to create order'
    }
  }
}
```

## Performance Optimization

### Batch Operations

```typescript
// actions.ts
'use server'

export async function batchUpdateUsers(
  prevState: any,
  formData: FormData
) {
  const updates = JSON.parse(formData.get('updates') as string)
  
  // Use transaction for batch updates
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

## Summary

React 22's Server Actions fundamentally change frontend-backend interaction. Through `useActionState`, `useOptimistic`, and `useTransition` Hooks, you can build responsive, well-error-handled modern forms. The key is understanding Server Actions' applicable scenarios—suitable for data mutation operations, while data fetching should still use Server Components and data fetching patterns.
