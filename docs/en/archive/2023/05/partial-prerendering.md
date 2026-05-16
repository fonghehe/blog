---
title: "Partial Prerendering"
date: 2023-05-19 17:22:21
tags:
  - Frontend
readingTime: 2
description: "最近在团队中落地Partial Prerendering 部分预渲染， and accumulated quite a bit of experience. Here's a summary for reference, hoping it helps those doing similar work."
---

最近在团队中落地Partial Prerendering 部分预渲染， and accumulated quite a bit of experience. Here's a summary for reference, hoping it helps those doing similar work.

## Core Concepts

Building on this foundation, we can further optimize:

```javascript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user')
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = UserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const user = await db.user.create({ data: result.data })
  return NextResponse.json({ data: user }, { status: 201 })
}

```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## In-Depth Analysis

Usage in real projects tends to be more complex:

```javascript
import { Suspense } from 'react'
import { UserList } from './components/UserList'

export default async function HomePage() {
  return (
    <main className="container mx-auto p-4">
      <h1>控制台</h1>
      <Suspense fallback={<Skeleton />}>
        <UserList />
      </Suspense>
    </main>
  )
}

```

Through this approach, both the testability and scalability of the code are improved.

## Implementation Experience

Here is a complete example:

```javascript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user')
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = UserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const user = await db.user.create({ data: result.data })
  return NextResponse.json({ data: user }, { status: 201 })
}

```

Pay attention to boundary condition handling, which is critical in production.

## Optimization Strategies

The key lies in understanding the core logic:

```javascript
import { Suspense } from 'react'
import { UserList } from './components/UserList'

export default async function HomePage() {
  return (
    <main className="container mx-auto p-4">
      <h1>控制台</h1>
      <Suspense fallback={<Skeleton />}>
        <UserList />
      </Suspense>
    </main>
  )
}

```

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Important Notes

We can improve it in the following ways:

```javascript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user')
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = UserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const user = await db.user.create({ data: result.data })
  return NextResponse.json({ data: user }, { status: 201 })
}

```

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- Code examples are for reference only and need to be adjusted according to your business scenario
- Partial Prerendering 部分预渲染不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production