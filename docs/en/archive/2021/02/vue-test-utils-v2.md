---
title: "Vue Test Utils v2 Testing Guide"
date: 2021-02-01 09:52:00
tags:
  - Vue
  - Testing
  - JavaScript

readingTime: 1
description: "关于Vue Test Utils v2 测试指南，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspecti"
---

关于Vue Test Utils v2 测试指南，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspective.

## Basic Principles

Let's start with the basic implementation:

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

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Advanced Features

Building on this foundation, we can further optimize:

```javascript
import { reactive, toRefs, computed } from 'vue'

function useCounter(initial = 0) {
  const state = reactive({ count: initial, history: [initial] })
  const doubled = computed(() => state.count * 2)

  function increment() {
    state.count++
    state.history.push(state.count)
  }

  return { ...toRefs(state), doubled, increment }
}

```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Project Practice

实际项目中的用法会更复杂一些：

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('组件已挂载') })

    return { count, doubled }
  }
}

```

Through this approach, both the testability and scalability of the code are improved.

## Best Practices

Here is a complete example:

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

Pay attention to boundary condition handling, which is critical in production.

## Summary

- Vue Test Utils v2 测试指南不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production
