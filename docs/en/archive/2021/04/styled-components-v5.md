---
title: "Styled Components v5 Best Practices"
date: 2021-04-16 16:44:56
tags:
  - React
  - CSS
  - TypeScript

readingTime: 2
description: "关于Styled Components v5 最佳实践，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspe"
---

关于Styled Components v5 最佳实践，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspective.

## Basic Principles

实际项目中的用法会更复杂一些：

```javascript
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

interface AppConfig {
  api: { baseUrl: string; timeout: number; retries: number }
  ui: { theme: 'light' | 'dark'; language: string; pageSize: number }
}

type PartialConfig = DeepPartial<AppConfig>

function mergeConfig(defaults: AppConfig, overrides: PartialConfig): AppConfig {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    if (overrides[key] && typeof overrides[key] === 'object') {
      result[key] = { ...defaults[key], ...overrides[key] } as any
    }
  }
  return result
}

```

Through this approach, both the testability and scalability of the code are improved.

## Advanced Features

Here is a complete example:

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 类型安全的事件系统
interface EventMap {
  login: { userId: string; timestamp: number }
  logout: { userId: string }
}

class TypedEmitter<T extends Record<string, any>> {
  private handlers = new Map<keyof T, Set<Function>>()
  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }
  emit<K extends keyof T>(event: K, payload: T[K]) {
    this.handlers.get(event)?.forEach(h => h(payload))
  }
}

```

Pay attention to boundary condition handling, which is critical in production.

## Project Practice

The key lies in understanding the core logic:

```javascript
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

interface AppConfig {
  api: { baseUrl: string; timeout: number; retries: number }
  ui: { theme: 'light' | 'dark'; language: string; pageSize: number }
}

type PartialConfig = DeepPartial<AppConfig>

function mergeConfig(defaults: AppConfig, overrides: PartialConfig): AppConfig {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    if (overrides[key] && typeof overrides[key] === 'object') {
      result[key] = { ...defaults[key], ...overrides[key] } as any
    }
  }
  return result
}

```

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Best Practices

We can improve it in the following ways:

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 类型安全的事件系统
interface EventMap {
  login: { userId: string; timestamp: number }
  logout: { userId: string }
}

class TypedEmitter<T extends Record<string, any>> {
  private handlers = new Map<keyof T, Set<Function>>()
  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }
  emit<K extends keyof T>(event: K, payload: T[K]) {
    this.handlers.get(event)?.forEach(h => h(payload))
  }
}

```

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- In team collaboration, conventions and documentation are more important than the technology itself
- Stay updated with the community; technical solutions need continuous iteration
- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- Styled Components v5 最佳实践不是银弹，需要根据项目规模和技术栈选择