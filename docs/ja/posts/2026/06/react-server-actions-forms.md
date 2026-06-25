---
title: "React 22 Server Actions 応用：フォーム処理とデータ変異パターン"
date: 2026-06-25 18:31:50
tags:
  - React
readingTime: 2
description: "Server Actions は React アプリケーションにおけるデータ変異の標準になった。複雑なフォーム処理における Server Actions の応用パターンとベストプラクティスを深く解説する。"
wordCount: 371
---

React 22 の Server Actions は、新機能からモダン React アプリケーションを構築するコア機能に進化した。フロントエンドとバックエンドの対話方法を変え——手動で API エンドポイントと fetch コールを記述する必要がなくなり、Server Actions によりデータ変異がより直感的になった。

## Server Actions の基本

Server Actions は `use server` でマークされた非同期関数で、クライアントコンポーネントから直接呼び出せる：

```typescript
// actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  
  // サーバーサイドのロジック
  const user = await db.user.create({
    data: { name, email }
  })
  
  // キャッシュの再検証
  revalidatePath('/users')
  
  return { success: true, user }
}
```

### クライアントサイドからの呼び出し

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

## 複雑なフォーム処理パターン

### 複数ステップのフォーム

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

### 楽観的 UI 更新

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
    
    // 楽観的更新：新しい todo を即座に表示
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

## パフォーマンスの最適化

### バッチ操作

```typescript
// actions.ts
'use server'

export async function batchUpdateUsers(
  prevState: any,
  formData: FormData
) {
  const updates = JSON.parse(formData.get('updates') as string)
  
  // トランザクションを使用してバッチ更新
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

## まとめ

React 22 の Server Actions は、フロントエンドとバックエンドの対話方法を根本的に変えた。`useActionState`、`useOptimistic`、`useTransition` フックを使用することで、応答性が高く、エラーハンドリングが適切なモダンフォームを構ームを構築できる。鍵は Server Actions の適用可能シナリオを理解すること——データ変異操作に適しており、データフェッチは引き続き Server Components とデータフェッチパターンを使用すべきだ。
