---
title: "React Testing Library ベストプラクティス"
date: 2020-07-03 17:18:36
tags:
  - React
readingTime: 3
description: "React Testing Library のベストプラクティスについて、多くの開発者は API 呼び出しのレイヤーにとどまっている。本記事では本番環境の視点から、実際に直面する問題とその解決策を議論する。"
wordCount: 498
---

React Testing Library のベストプラクティスについて、多くの開発者は API 呼び出しのレイヤーにとどまっている。本記事では本番環境の視点から、実際に直面する問題とその解決策を議論する。

## 基本原理

以下に完全なサンプルを示す：

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

境界条件の処理に注意すること。これは本番環境では極めて重要だ。

## 高度な機能

重要なのはコアとなるロジックを理解することだ：

```javascript
import { test, expect } from '@playwright/test'

test.describe('用户登录流程', () => {
  test('成功登录跳转到首页', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'admin123')
    await page.click('[data-testid="submit-btn"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('.welcome')).toContainText('欢迎回来')
  })
})

```

パフォーマンス最適化は具体的なシナリオに応じて行う必要があり、すべてのケースで過度な最適化が必要なわけではない。

## プロジェクト実践

以下のアプローチで改善できる：

```javascript
import { useRef, useEffect, useState } from 'react'

function useIntersectionObserver(options = {}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
    }, { threshold: 0.1, ...options })
    const el = ref.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [])

  return [ref, isVisible]
}

```

このアプローチは本番環境で半年以上安定稼働しており、実際に検証済みだ。

## ベストプラクティス

まず基本的な実装方法を見てみよう：

```javascript
import { useState, useEffect, useCallback } from 'react'

function DataList({ endpoint, pageSize = 20 }) {
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?page=${page}&size=${pageSize}`)
      setData(await res.json())
    } finally { setLoading(false) }
  }, [endpoint, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  return <div>{loading ? <Spinner /> : <List items={data} />}</div>
}

```

このコードは基本的な使い方を示している。実際のプロジェクトではエラー処理や境界条件も考慮する必要がある。

## ハマりやすい注意点

これをベースにさらに最適化できる：

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('提交有效的登录表单', async () => {
    const onSubmit = jest.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/邮箱/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/密码/), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /登录/ }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com', password: 'password123'
      })
    })
  })
})

```

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## まとめ

- チームでの合意とドキュメントは、技術そのものよりも重要だ
- コミュニティの動向を注視し、技術案は継続的に改善していく必要がある
- 新しい技術のために新しい技術を使うのは避けるべきだ
