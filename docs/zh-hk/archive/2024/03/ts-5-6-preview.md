---
title: "TypeScript 5.6 預覽特性"
date: 2024-03-06 10:05:16
tags:
  - TypeScript
readingTime: 2
description: "關於TypeScript 5.6 預覽特性，很多開發者只停留在 API 調用層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。"
---

關於TypeScript 5.6 預覽特性，很多開發者只停留在 API 調用層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。

## 基本原理

先來看基本的實現方式：

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

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 高級特性

在這個基礎上，我們可以進一步優化：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 類型安全的事件系統
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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 項目實踐

實際項目中的用法會更復雜一些：

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

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 最佳實踐

以下是一個完整的示例：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 類型安全的事件系統
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

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- TypeScript 5.6 預覽特性不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證