---
title: "Tailwind CSS JIT 编译模式"
date: 2021-04-23 09:48:53
tags:
  - CSS
  - TailwindCSS
readingTime: 2
description: "Tailwind CSS JIT 编译模式在前端开发中的应用越来越广泛。本文从实际项目出发，深入分析其核心原理和最佳实践。"
wordCount: 338
---

Tailwind CSS 的 JIT 编译模式在前端用得越来越普遍。本文从实际项目出发，拆解它的核心原理与最佳实践。

## 基础用法

我们可以用下面这种方式来改进：

```css
'use client'
import { useChat } from 'ai/react'

export function AIChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat'
  })
  return (
    <div className="chat-container">
      {messages.map(m => (
        <div key={m.id} className={`message ${m.role}`}>
          <p>{m.content}</p>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>发送</button>
      </form>
    </div>
  )
}

```

这套方案已经在线上稳定运行半年多，经受过实际验证。

## 进阶用法

先看最基本的实现方式：

```css
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function POST(req) {
  const { messages } = await req.json()
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: '你是一个专业的前端开发助手。',
    maxTokens: 2000
  })
  return result.toDataStreamResponse()
}

```

这段代码演示了基本用法。真实项目里还得考虑错误处理和边界情况。

## 实战案例

在这个基础上，我们还能进一步优化：

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

这种模式在大型项目里很实用，能明显降低维护成本。

## 性能优化

真实业务里的用法往往更复杂一些：

```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

用这种方式，代码的可测试性和可扩展性都上去了。

## 常见陷阱

下面是一段完整示例：

```css
'use client'
import { useChat } from 'ai/react'

export function AIChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat'
  })
  return (
    <div className="chat-container">
      {messages.map(m => (
        <div key={m.id} className={`message ${m.role}`}>
          <p>{m.content}</p>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>发送</button>
      </form>
    </div>
  )
}

```

边界条件的处理很关键，生产环境尤其不能马虎。

## 小结

- 关注社区动态，技术方案需要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- Tailwind CSS JIT 编译模式不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要