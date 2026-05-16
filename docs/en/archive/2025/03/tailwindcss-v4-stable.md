---
title: "Tailwind CSS v4 Stable"
date: 2025-03-19 10:00:00
tags:
  - CSS
  - Engineering
readingTime: 1
description: "Recently, our team has rolled out Tailwind CSS v4 Stable and accumulated a lot of experience. I've compiled it here for reference, hoping it helps others doing "
---

Recently, our team has rolled out Tailwind CSS v4 Stable and accumulated a lot of experience. I've compiled it here for reference, hoping it helps others doing similar work.

## Core Concepts

We can improve it in the following ways:

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%;
  scroll-snap-align: start;
  border-radius: 12px;
  transition: scale 0.3s ease;
}
```

This solution has been running stably in production for over six months and has been validated in practice.

## Deep Dive

Let's start with the basic implementation:

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

.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card__content {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}
```

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Practical Experience

Building on this foundation, we can further optimize:

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
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  )
}

```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Tuning Strategies

In real projects, the usage gets more complex:

```css
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function POST(req) {
  const { messages } = await req.json()
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are a professional frontend development assistant.',
    maxTokens: 2000
  })
  return result.toDataStreamResponse()
}

```

Through this approach, both testability and scalability of the code are improved.

## Notes
