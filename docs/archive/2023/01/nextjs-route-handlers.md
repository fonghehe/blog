---
title: "Next.js Route Handlers API 路由"
date: 2023-01-30 15:09:48
tags:
  - Next.js
readingTime: 3
description: "Next.js 13 的 Route Handlers 取代了 Pages Router 中的 API Routes，基于 Web 标准的 Request/Response API。如果你之前用过 Express 或 Cloudflare Workers，会发现这套 API 非常熟悉。本文介绍 Route Handle"
wordCount: 330
---

Next.js 13 的 Route Handlers 取代了 Pages Router 中的 API Routes，基于 Web 标准的 Request/Response API。如果你之前用过 Express 或 Cloudflare Workers，会发现这套 API 非常熟悉。本文介绍 Route Handlers 的实际用法和最佳实践。

## 基本结构与 HTTP 方法

Route Handlers 定义在 `app/api/` 目录下的 `route.ts` 文件中，通过导出命名函数对应 HTTP 方法。

```ts
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/posts
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const posts = await db.post.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true, avatar: true } } },
  })

  const total = await db.post.count()

  return NextResponse.json({
    posts,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

// POST /api/posts
export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!body.title || body.title.length < 2) {
    return NextResponse.json(
      { error: '标题至少2个字符' },
      { status: 400 }
    )
  }

  const post = await db.post.create({
    data: {
      title: body.title,
      content: body.content,
      slug: body.title.toLowerCase().replace(/\s+/g, '-'),
      authorId: body.authorId,
    },
  })

  return NextResponse.json(post, { status: 201 })
}
```

不能导出默认函数，必须用 `GET`、`POST`、`PUT`、`DELETE`、`PATCH`、`HEAD`、`OPTIONS` 这些命名导出。这比 Pages Router 的 `export default function handler(req, res)` 更明确。

## 动态路由与路由组

动态参数通过目录名中的 `[param]` 获取，与页面路由的约定一致。

```ts
// app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const post = await db.post.findUnique({
    where: { id: params.id },
    include: {
      comments: { orderBy: { createdAt: 'desc' }, take: 50 },
      author: { select: { name: true, avatar: true } },
    },
  })

  if (!post) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 })
  }

  return NextResponse.json(post)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const body = await request.json()

  const post = await db.post.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json(post)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  await db.post.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true }, { status: 200 })
}
```

## 流式响应与 SSE

Route Handlers 支持返回 `ReadableStream`，适用于 SSE（Server-Sent Events）和文件流下载。

```ts
// app/api/events/route.ts
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // 每秒推送一次消息
      const interval = setInterval(() => {
        const data = JSON.stringify({
          timestamp: Date.now(),
          message: 'heartbeat',
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }, 1000)

      // 客户端断开连接时清理
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

```ts
// app/api/download/[filename]/route.ts
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  const filePath = join(process.cwd(), 'uploads', params.filename)
  const file = await readFile(filePath)

  return new Response(file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${params.filename}"`,
    },
  })
}
```

## 中间件配合与认证

Route Handlers 与 Next.js Middleware 配合可以实现认证、限流等横切关注点。

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  // 只保护 /api/admin/* 路径
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    try {
      const payload = await verifyToken(token)
      const headers = new Headers(request.headers)
      headers.set('x-user-id', payload.userId)
      headers.set('x-user-role', payload.role)

      return NextResponse.next({ request: { headers } })
    } catch {
      return NextResponse.json({ error: 'Token 无效' }, { status: 401 })
    }
  }
}

export const config = {
  matcher: '/api/admin/:path*',
}
```

```ts
// app/api/admin/stats/route.ts
export async function GET(request: NextRequest) {
  // 从 middleware 传递的 header 中获取用户信息
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role')

  if (role !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  const stats = await db.$queryRaw`
    SELECT
      COUNT(*) as total_posts,
      COUNT(DISTINCT "authorId") as total_authors
    FROM "Post"
  `

  return NextResponse.json(stats)
}
```

## 小结

- Route Handlers 基于 Web 标准的 Request/Response API，比 Pages Router 的 `req/res` 模型更现代
- 动态参数通过目录命名约定获取，与页面路由一致
- 支持流式响应，可以实现 SSE、文件下载等场景
- 与 Middleware 配合做认证是推荐模式，不要在每个 Handler 中重复鉴权逻辑
- Route Handlers 自动支持 Edge Runtime，只需在文件顶部导出 `export const runtime = 'edge'`