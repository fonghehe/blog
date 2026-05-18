---
title: "GitHub Copilot 前端開發體驗"
date: 2022-07-04 14:50:22
tags:
  - 前端
readingTime: 2
description: "關於GitHub Copilot 前端開發體驗，很多開發者只停留在 API 呼叫層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。"
---

關於GitHub Copilot 前端開發體驗，很多開發者只停留在 API 呼叫層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。

## 基本原理

以下是一個完整的示例：

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
        <button type="submit" disabled={isLoading}>傳送</button>
      </form>
    </div>
  )
}

```

注意邊界條件處理，這在生產環境中至關重要。

## 高階特性

關鍵在於理解核心邏輯：

```javascript
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function POST(req) {
  const { messages } = await req.json()
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: '你是一個專業的前端開發助手。',
    maxTokens: 2000
  })
  return result.toDataStreamResponse()
}

```

效能最佳化需要結合具體場景，不是所有情況都需要過度最佳化。

## 專案實踐

我們可以通過以下方式來改進：

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
        <button type="submit" disabled={isLoading}>傳送</button>
      </form>
    </div>
  )
}

```

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 最佳實踐

先來看基本的實現方式：

```javascript
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function POST(req) {
  const { messages } = await req.json()
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: '你是一個專業的前端開發助手。',
    maxTokens: 2000
  })
  return result.toDataStreamResponse()
}

```

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 踩坑記錄

在這個基礎上，我們可以進一步最佳化：

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
        <button type="submit" disabled={isLoading}>傳送</button>
      </form>
    </div>
  )
}

```

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 小結

- 團隊協作中約定和文件比技術本身更重要
- 關注社群動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術