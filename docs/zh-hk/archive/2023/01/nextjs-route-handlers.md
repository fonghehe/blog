---
title: "Next.js Route Handlers API 路由"
date: 2023-01-30 15:09:48
tags:
  - Next.js
readingTime: 3
description: "Next.js 13 的 Route Handlers 取代了 Pages Router 中的 API Routes，基於 Web 標準的 Request/Response API。如果你之前用過 Express 或 Cloudflare Workers，會發現這套 API 非常熟悉。本文介紹 Route Handle"
---

Next.js 13 的 Route Handlers 取代了 Pages Router 中的 API Routes，基於 Web 標準的 Request/Response API。如果你之前用過 Express 或 Cloudflare Workers，會發現這套 API 非常熟悉。本文介紹 Route Handlers 的實際用法和最佳實踐。

## 基本結構與 HTTP 方法

Route Handlers 定義在 `app/api/` 目錄下的 `route.ts` 文件中，通過導出命名函數對應 HTTP 方法。

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
      { error: '標題至少2個字符' },
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

不能導出默認函數，必須用 `GET`、`POST`、`PUT`、`DELETE`、`PATCH`、`HEAD`、`OPTIONS` 這些命名導出。這比 Pages Router 的 `export default function handler(req, res)` 更明確。

## 動態路由與路由組

動態參數通過目錄名中的 `[param]` 獲取，與頁面路由的約定一致。

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

## 流式響應與 SSE

Route Handlers 支持返回 `ReadableStream`，適用於 SSE（Server-Sent Events）和文件流下載。

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

      // 客户端斷開連接時清理
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

## 中間件配合與認證

Route Handlers 與 Next.js Middleware 配合可以實現認證、限流等橫切關注點。

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  // 只保護 /api/admin/* 路徑
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    try {
      const payload = await verifyToken(token)
      const headers = new Headers(request.headers)
      headers.set('x-user-id', payload.userId)
      headers.set('x-user-role', payload.role)

      return NextResponse.next({ request: { headers } })
    } catch {
      return NextResponse.json({ error: 'Token 無效' }, { status: 401 })
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
  // 從 middleware 傳遞的 header 中獲取用户信息
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role')

  if (role !== 'admin') {
    return NextResponse.json({ error: '需要管理員權限' }, { status: 403 })
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

## 小結

- Route Handlers 基於 Web 標準的 Request/Response API，比 Pages Router 的 `req/res` 模型更現代
- 動態參數通過目錄命名約定獲取，與頁面路由一致
- 支持流式響應，可以實現 SSE、文件下載等場景
- 與 Middleware 配合做認證是推薦模式，不要在每個 Handler 中重複鑑權邏輯
- Route Handlers 自動支持 Edge Runtime，只需在文件頂部導出 `export const runtime = 'edge'`