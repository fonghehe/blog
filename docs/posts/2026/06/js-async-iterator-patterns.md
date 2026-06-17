---
title: "JavaScript 迭代器协议 2026：AsyncIterator 与 Generator 的高级模式"
date: 2026-06-17 12:40:41
tags:
  - JavaScript
readingTime: 3
description: "迭代器协议是 JavaScript 异步编程的基石之一。本文深入探讨 AsyncIterator、Generator 和异步迭代的高级模式，帮助你在复杂场景中优雅地处理数据流。"
wordCount: 280
---

JavaScript 的迭代器协议从同步发展到异步，已经成为处理流式数据的核心能力。2026 年，AsyncIterator 和 Generator 的配合使用更加成熟，为复杂的数据处理场景提供了优雅的解决方案。

## 迭代器协议基础回顾

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

异步迭代器增加了 `async` 维度：

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

## Generator 的高级用法

### 双向 Generator

Generator 不仅可以产出值，还可以接收值：

```typescript
function*双向通信() {
  const commands: string[] = []
  
  while (true) {
    const command = yield // 接收外部输入
    
    switch (command) {
      case 'start':
        commands.push('started')
        yield '已启动' // 产出结果
        break
      case 'stop':
        commands.push('stopped')
        yield '已停止'
        break
      case 'status':
        yield `历史命令: ${commands.join(', ')}`
        break
    }
  }
}

const gen =双向通信()
gen.next() // 启动迭代器
console.log(gen.next('start').value)  // '已启动'
console.log(gen.next('stop').value)   // '已停止'
console.log(gen.next('status').value) // '历史命令: started, stopped'
```

### 带缓冲的 Generator

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
  
  // 处理剩余元素
  if (buffer.length > 0) {
    yield buffer
  }
}

// 使用示例
const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const batches = bufferedGenerator(data, 3)

for (const batch of batches) {
  console.log(batch) // [1,2,3], [4,5,6], [7,8,9], [10]
}
```

## AsyncIterator 的实际应用

### 流式数据处理

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

// 使用示例
for await (const line of readLines('data.jsonl')) {
  const data = JSON.parse(line)
  console.log(data)
}
```

### 分页 API 处理

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

// 使用示例：自动处理分页
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

## 组合模式

### Pipeline 模式

```typescript
function* pipeline<T>(
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

// 使用示例
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

### 转换器组合

```typescript
class StreamTransformer<T, R> {
  constructor(
    private transform: (item: T) => R | Promise<R>
  ) {}
  
  async *transformStream(
    source: AsyncIterable<T>
  ): AsyncGenerator<R> {
    for await (const item of source) {
      yield await this.transform(item)
    }
  }
}

// 使用示例
const upperCaseTransformer = new StreamTransformer<string, string>(
  async (item) => item.toUpperCase()
)

const parseJsonTransformer = new StreamTransformer<string, object>(
  async (item) => JSON.parse(item)
)

// 组合多个转换器
async function* composeTransformers<T>(
  source: AsyncIterable<T>,
  ...transformers: StreamTransformer<any, any>[]
): AsyncGenerator<any> {
  let current: AsyncIterable<any> = source
  
  for (const transformer of transformers) {
    current = transformer.transformStream(current)
  }
  
  yield* current
}
```

## 错误处理

### 带错误恢复的 AsyncIterator

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
      
      retryCount = 0  // 成功时重置重试计数
      yield result.value
    } catch (error) {
      retryCount++
      
      if (retryCount > maxRetries) {
        throw new Error(`超过最大重试次数: ${error}`)
      }
      
      console.warn(`重试 ${retryCount}/${maxRetries}: ${error}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
    }
  }
}
```

### 取消支持

```typescript
async function* cancellableIterator<T>(
  source: AsyncIterable<T>,
  signal: AbortSignal
): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]()
  
  try {
    while (!signal.aborted) {
      const result = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('操作已取消'))
          }, { once: true })
        })
      ])
      
      if (result.done) {
        break
      }
      
      yield result.value
    }
  } finally {
    // 清理资源
    if (typeof iterator.return === 'function') {
      await iterator.return()
    }
  }
}

// 使用示例
const controller = new AbortController()

const iterator = cancellableIterator(
  fetchDataStream(),
  controller.signal
)

// 5秒后自动取消
setTimeout(() => controller.abort(), 5000)

try {
  for await (const item of iterator) {
    console.log(item)
  }
} catch (error) {
  if (error.message === '操作已取消') {
    console.log('迭代已取消')
  }
}
```

## 性能优化

### 批量处理

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

### 并发控制

```typescript
async function* concurrentProcessor<T, R>(
  source: AsyncIterable<T>,
  concurrency: number,
  processor: (item: T) => Promise<R>
): AsyncGenerator<R> {
  const queue: Promise<R>[] = []
  
  for await (const item of source) {
    const promise = processor(item)
    queue.push(promise)
    
    if (queue.length >= concurrency) {
      const result = await Promise.race(queue)
      const index = queue.findIndex(p => p === result || p.then === result.then)
      if (index > -1) queue.splice(index, 1)
      yield result
    }
  }
  
  // 处理剩余任务
  for (const promise of queue) {
    yield await promise
  }
}
```

## 小结

AsyncIterator 和 Generator 是 JavaScript 处理流式数据的核心能力。从简单的分页处理到复杂的并发控制，这些模式在实际项目中有着广泛的应用。掌握这些高级模式的关键是理解"惰性求值"和"背压控制"的思维方式——让数据按需产生，而不是一次性加载所有数据。
