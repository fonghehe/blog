---
title: "JavaScript Iterator Protocol 2026: AsyncIterator and Generator Advanced Patterns"
date: 2026-06-17 12:40:41
tags:
  - JavaScript
readingTime: 2
description: "Iterator protocol is one of the cornerstones of JavaScript async programming. This article explores AsyncIterator, Generator, and async iteration advanced patterns for elegant data stream handling."
wordCount: 145
---

JavaScript's iterator protocol has evolved from synchronous to asynchronous, becoming a core capability for handling streaming data. In 2026, the combination of AsyncIterator and Generator is more mature, providing elegant solutions for complex data processing scenarios.

## Iterator Protocol Basic Review

The core of synchronous iterators is `Symbol.iterator`:

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

Async iterators add the `async` dimension:

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

## Generator Advanced Usage

### Bidirectional Generator

Generators can not only produce values but also receive them:

```typescript
function* bidirectional() {
  const commands: string[] = []
  
  while (true) {
    const command = yield // Receive external input
    
    switch (command) {
      case 'start':
        commands.push('started')
        yield 'started' // Produce result
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
gen.next() // Start iterator
console.log(gen.next('start').value)  // 'started'
console.log(gen.next('stop').value)   // 'stopped'
console.log(gen.next('status').value) // 'History: started, stopped'
```

### Buffered Generator

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
  
  // Handle remaining elements
  if (buffer.length > 0) {
    yield buffer
  }
}

// Usage example
const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const batches = bufferedGenerator(data, 3)

for (const batch of batches) {
  console.log(batch) // [1,2,3], [4,5,6], [7,8,9], [10]
}
```

## AsyncIterator Practical Applications

### Streaming Data Processing

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

// Usage example
for await (const line of readLines('data.jsonl')) {
  const data = JSON.parse(line)
  console.log(data)
}
```

### Pagination API Handling

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

// Usage: automatically handle pagination
async function getAllUsers() {
  const users: User[] = []
  
  for await (const user of paginateApi(async (page) => {
    const response = await fetch(`/api/users?page=${page}`)
    const data = await response.json()
    return {
      data: data.users,
      hasMore: data.page < data.totalPages
    }
  })) {
    users.push(user)
  }
  
  return users
}
```

## Composition Patterns

### Pipeline Pattern

```typescript
function pipeline<T>(
  ...generators: Array<(input: any) => Generator<any>>
): Generator<any> {
  let input: any = undefined
  
  for (const generatorFn of generators) {
    const gen = generatorFn(input)
    let result = gen.next()
    
    while (!result.done) {
      yield result.value
      result = gen.next()
    }
    
    input = result.value
  }
}

// Usage example
function* readSource(): Generator<string> {
  yield '  Hello World  '
  yield '  Foo Bar  '
}

function* trim(items: Iterable<string>): Generator<string> {
  for (const item of items) {
    yield item.trim()
  }
}

function* toUpperCase(items: Iterable<string>): Generator<string> {
  for (const item of items) {
    yield item.toUpperCase()
  }
}

const result = [...pipeline(readSource, trim, toUpperCase)]
// ['HELLO WORLD', 'FOO BAR']
```

## Error Handling

### Resilient AsyncIterator

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
      
      retryCount = 0  // Reset retry count on success
      yield result.value
    } catch (error) {
      retryCount++
      
      if (retryCount > maxRetries) {
        throw new Error(`Max retries exceeded: ${error}`)
      }
      
      console.warn(`Retrying ${retryCount}/${maxRetries}: ${error}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
    }
  }
}
```

## Performance Optimization

### Batch Processing

```typescript
async function* batchProcessor<T>(
  source: AsyncIterable<T>,
  batchSize: number,
  processor: (batch: T[]) => Promise<any>
): AsyncGenerator<any> {
  let batch: T[] = []
  
  for await (const item of source) {
    batch.push(item)
    
    if (batch.length >= batchSize) {
      yield await processor([...batch])
      batch = []
    }
  }
  
  if (batch.length > 0) {
    yield await processor(batch)
  }
}
```

## Summary

AsyncIterator and Generator are JavaScript's core capabilities for handling streaming data. From simple pagination handling to complex concurrency control, these patterns have wide applications in real projects. The key to mastering these advanced patterns is understanding "lazy evaluation" and "backpressure control"—letting data be produced on demand rather than loading all data at once.
