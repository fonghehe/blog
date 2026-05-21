---
title: "RAG 應用前端集成：架構設計與實現"
date: 2024-03-25 09:48:02
tags:
  - 前端
readingTime: 3
description: "最近團隊在內部知識庫項目中落地了 RAG（Retrieval-Augmented Generation）架構。作為前端平台負責人，整理一下前端側的技術方案。"
wordCount: 294
---

最近團隊在內部知識庫項目中落地了 RAG（Retrieval-Augmented Generation）架構。作為前端平台負責人，整理一下前端側的技術方案。

## RAG 基礎架構

```
用户提問 → 向量檢索（相似文檔片段）→ 拼裝 Prompt → LLM 生成回答 → 流式返回前端
```

前端需要處理的核心問題：流式響應渲染、引用來源展示、對話狀態管理。

## 流式響應處理

LLM 返回是流式的，用 Server-Sent Events 最合適：

```typescript
// src/lib/rag-client.ts
interface RagResponse {
  content: string;
  sources: Array<{ title: string; url: string; score: number }>;
  done: boolean;
}

export async function* streamRagResponse(
  query: string,
  sessionId: string
): AsyncGenerator<RagResponse> {
  const response = await fetch("/api/rag/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, sessionId }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // 跳過不完整的 JSON
        }
      }
    }
  }
}
```

## 對話組件實現

```tsx
// src/components/RagChat.tsx
import { streamRagResponse } from "@/lib/rag-client";
import { useState, useRef, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string }>;
  isStreaming?: boolean;
}

export function RagChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const assistantMsg: Message = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      for await (const chunk of streamRagResponse(input, "default")) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          last.content = chunk.content;
          if (chunk.sources) last.sources = chunk.sources;
          if (chunk.done) last.isStreaming = false;
          return updated;
        });
      }
    } catch (err) {
      console.error("RAG request failed:", err);
    }
  }, [input]);

  return (
    <div className="rag-chat">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="content">{msg.content}</div>
            {msg.isStreaming && <span className="cursor">|</span>}
            {msg.sources?.length > 0 && (
              <div className="sources">
                <span className="sources-label">參考來源：</span>
                {msg.sources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener">
                    {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
        />
        <button onClick={sendMessage}>發送</button>
      </div>
    </div>
  );
}
```

## 向量檢索狀態管理

用 Zustand 管理對話狀態和上下文：

```typescript
// src/stores/rag-store.ts
import { create } from "zustand";

interface RagState {
  messages: Message[];
  sessionId: string;
  isRetrieving: boolean;
  addMessage: (msg: Message) => void;
  setRetrieving: (val: boolean) => void;
  clearHistory: () => void;
}

export const useRagStore = create<RagState>((set) => ({
  messages: [],
  sessionId: crypto.randomUUID(),
  isRetrieving: false,
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  setRetrieving: (val) => set({ isRetrieving: val }),
  clearHistory: () =>
    set({ messages: [], sessionId: crypto.randomUUID() }),
}));
```

## 引用來源的高亮渲染

回答中標註引用的部分要特殊渲染：

```tsx
function renderContent(content: string, sources: Source[]) {
  // 匹配 [1] [2] 這樣的引用標記
  const parts = content.split(/(\[\d+\])/g);

  return parts.map((part, i) => {
    const match = part.match(/\[(\d+)\]/);
    if (match) {
      const idx = parseInt(match[1]) - 1;
      const source = sources[idx];
      return source ? (
        <sup key={i} className="citation" title={source.title}>
          [{idx + 1}]
        </sup>
      ) : (
        part
      );
    }
    return part;
  });
}
```

## 性能優化

1. **消息列表虛擬化**：長對話歷史用 `@tanstack/react-virtual` 渲染
2. **打字機效果節流**：流式更新用 `requestAnimationFrame` 合併，避免每次 chunk 都觸發重排
3. **Markdown 渲染**：用 `react-markdown` + `remark-gfm`，對代碼塊做語法高亮

## 小結

- RAG 前端核心是流式響應處理和引用來源展示
- SSE + AsyncGenerator 是流式渲染的最佳實踐
- 對話狀態用 Zustand 管理，避免 prop drilling
- 引用標註需要在渲染層做特殊處理
- 虛擬化和渲染節流對長對話很重要