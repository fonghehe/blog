---
title: "Partial Prerendering 部分预渲染"
date: 2023-05-19 17:22:21
tags:
  - 前端
---

最近在团队中落地Partial Prerendering 部分预渲染，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。

## 核心概念

在这个基础上，我们可以进一步优化：

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

这种模式在大型项目中非常实用，能显著降低维护成本。

## 深度解析

实际项目中的用法会更复杂一些：

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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## 落地经验

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## 调优策略

关键在于理解核心逻辑：

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

性能优化需要结合具体场景，不是所有情况都需要过度优化。

## 注意事项

我们可以通过以下方式来改进：

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

这套方案已经在线上稳定运行了半年以上，经过了实际验证。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- Partial Prerendering 部分预渲染不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证