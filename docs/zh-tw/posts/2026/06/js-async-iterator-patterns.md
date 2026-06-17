---
title: "JavaScript 迭代器協議 2026：AsyncIterator 與 Generator 的進階模式"
date: 2026-06-17 12:40:41
tags:
  - JavaScript
readingTime: 2
description: "迭代器協議是 JavaScript 非同步程式設計的基石之一。本文深入探討 AsyncIterator、Generator 和非同步迭代的進階模式，幫助你在複雜場景中優雅地處理資料流。"
wordCount: 230
---

JavaScript 的迭代器協議從同步發展到非同步，已經成為處理串流資料的核心能力。2026 年，AsyncIterator 和 Generator 的配合使用更加成熟，為複雜的資料處理場景提供了優雅的解決方案。

## 迭代器協議基礎回顧

同步迭代器的核心是 `Symbol.iterator`：

```typescript
interface Iterator<T> {
  next(): { value: T; done: boolean }
  return?(value?: T): { value: T; done: boolean }
  throw?(e?: any): { value: T; done: boolean }
}

interface Iterable<T> {
  [Symbol.iterator](): Iterator<T>
}
```

非同步迭代器增加了 `async` 維度：

```typescript
interface AsyncIterator<T> {
  next(): Promise<{ value: T; done: boolean }>
  return?(value?: T): Promise<{ value: T; done: boolean }>
  throw?(e?: any): Promise<{ value: T; done: boolean }>
}

interface AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>
}
```

## Generator 的進階用法

### 雙向 Generator

Generator 不僅可以產出值，還可以接收值：

```typescript
function* bidirectional() {
  const commands: string[] = []
  
  while (true) {
    const command = yield // 接收外部輸入
    
    switch (command) {
      case 'start':
        commands.push('started')
        yield 'started'
        break
      case 'stop':
        commands.push('stopped')
        yield 'stopped'
        break
    }
  }
}

const gen = bidirectional()
gen.next()
console.log(gen.next('start').value)  // 'started'
console.log(gen.next('stop').value)   // 'stopped'
```

## AsyncIterator 的實際應用

### 串流資料處理

```typescript
async function* readLines(filePath) {
  const { createReadStream } = await import('node:fs')
  const stream = createReadStream(filePath, { encoding: 'utf8' })
  
  let buffer = ''
  
  for await (const chunk of stream) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.trim()) {
        yield line
      }
    }
  }
}
```

### 分頁 API 處理

```typescript
async function* paginateApi(fetchFn) {
  let page = 1
  let hasMore = true
  
  while (hasMore) {
    const response = await fetchFn(page)
    
    for (const item of response.data) {
      yield item
    }
    
    hasMore = response.hasMore
    page++
  }
}
```

## 錯誤處理

### 帶錯誤恢復的 AsyncIterator

```typescript
async function* resilientIterator(source, maxRetries = 3) {
  let retryCount = 0
  
  const iterator = source[Symbol.asyncIterator]()
  
  while (true) {
    try {
      const result = await iterator.next()
      
      if (result.done) break
      
      retryCount = 0
      yield result.value
    } catch (error) {
      retryCount++
      
      if (retryCount > maxRetries) {
        throw new Error(`超過最大重試次數: ${error}`)
      }
      
      console.warn(`重試 ${retryCount}/${maxRetries}: ${error}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
    }
  }
}
```

## 小結

AsyncIterator 和 Generator 是 JavaScript 處理串流資料的核心能力。從簡單的分頁處理到複雜的並發控制，這些模式在實際專案中有著廣泛的應用。掌握這些進階模式的關鍵是理解「惰性求值」和「背壓控制」的思維方式。
