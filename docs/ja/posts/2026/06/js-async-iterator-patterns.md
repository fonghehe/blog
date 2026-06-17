---
title: "JavaScript イテレータプロトコル 2026：AsyncIterator と Generator の高度なパターン"
date: 2026-06-17 12:40:41
tags:
  - JavaScript
readingTime: 2
description: "イテレータプロトコルは JavaScript 非同期プログラミングの礎の一つだ。AsyncIterator、Generator、非同期イテレーションの高度なパターンを深く解説し、複雑なデータストリームをエレガントに処理する方法を学ぶ。"
wordCount: 408
---

JavaScript のイテレータプロトコルは同期から非同期へと進化し、ストリーミングデータを処理するコア機能となっている。2026 年、AsyncIterator と Generator の組み合わせはより成熟し、複雑なデータ処理シナリオにエレガントなソリューションを提供している。

## イテレータプロトコルの基本復習

同期イテレータのコアは `Symbol.iterator` だ：

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

非同期イテレータは `async` 次元を追加する：

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

## Generator の高度な使い方

### 双方向 Generator

Generator は値を生成するだけでなく、値を受け取ることもできる：

```typescript
function* bidirectional() {
  const commands: string[] = []
  
  while (true) {
    const command = yield // 外部入力を受信
    
    switch (command) {
      case 'start':
        commands.push('started')
        yield 'started'
        break
      case 'stop':
        commands.push('stopped')
        yield 'stopped'
        break
      case 'status':
        yield `History: ${commands.join(', ')}`
        break
    }
  }
}

const gen = bidirectional()
gen.next()
console.log(gen.next('start').value)  // 'started'
console.log(gen.next('stop').value)   // 'stopped'
console.log(gen.next('status').value) // 'History: started, stopped'
```

### バッファ付き Generator

```typescript
function* bufferedGenerator<T>(
  source: Iterable<T>,
  bufferSize: number
): Generator<T[]> {
  let buffer: T[] = []
  
  for (const item of source) {
    buffer.push(item)
    
    if (buffer.length >= bufferSize) {
      yield [...buffer]
      buffer = []
    }
  }
  
  if (buffer.length > 0) {
    yield buffer
  }
}

const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const batches = bufferedGenerator(data, 3)

for (const batch of batches) {
  console.log(batch) // [1,2,3], [4,5,6], [7,8,9], [10]
}
```

## AsyncIterator の実践的応用

### ストリーミングデータ処理

```typescript
async function* readLines(filePath: string): AsyncGenerator<string> {
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
  
  if (buffer.trim()) {
    yield buffer
  }
}
```

### ページネーション API 処理

```typescript
async function* paginateApi<T>(
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>
): AsyncGenerator<T> {
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

## エラーハンドリング

### レジリエント AsyncIterator

```typescript
async function* resilientIterator<T>(
  source: AsyncIterable<T>,
  maxRetries: number = 3
): AsyncGenerator<T> {
  let retryCount = 0
  
  const iterator = source[Symbol.asyncIterator]()
  
  while (true) {
    try {
      const result = await iterator.next()
      
      if (result.done) {
        break
      }
      
      retryCount = 0
      yield result.value
    } catch (error) {
      retryCount++
      
      if (retryCount > maxRetries) {
        throw new Error(`最大リトライ回数を超過: ${error}`)
      }
      
      console.warn(`リトライ ${retryCount}/${maxRetries}: ${error}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
    }
  }
}
```

## まとめ

AsyncIterator と Generator は、ストリーミングデータを処理する JavaScript のコア機能だ。シンプルなページネーション処理から複雑な並列制御まで、这些パターンは実際のプロジェクトで広く応用されている。これらの高度なパターンをマスターする鍵は、「遅延評価」と「バックプレッシャー制御」の考え方を理解すること——すべてのデータを一度にロードするのではなく、必要に応じてデータを生成させることだ。
