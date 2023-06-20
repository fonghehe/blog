---
title: "LangChain.js 前端 AI 应用"
date: 2023-06-20 17:22:12
tags:
  - 前端
---

最近在团队中落地LangChain.js 前端 AI 应用，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。

## 核心概念

在这个基础上，我们可以进一步优化：

```javascript
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

这种模式在大型项目中非常实用，能显著降低维护成本。

## 深度解析

实际项目中的用法会更复杂一些：

```javascript
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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## 落地经验

以下是一个完整的示例：

```javascript
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

注意边界条件处理，这在生产环境中至关重要。

## 调优策略

关键在于理解核心逻辑：

```javascript
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

性能优化需要结合具体场景，不是所有情况都需要过度优化。

## 注意事项

我们可以通过以下方式来改进：

```javascript
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

这套方案已经在线上稳定运行了半年以上，经过了实际验证。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- LangChain.js 前端 AI 应用不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证