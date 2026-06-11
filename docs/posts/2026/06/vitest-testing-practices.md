---
title: "Vitest 3.0 快照测试与组件测试最佳实践"
date: 2026-06-11 10:58:36
tags:
  - 测试
  - Vitest
readingTime: 3
description: "Vitest 3.0 带来了更快的快照测试、更好的组件测试支持和改进的覆盖率报告。本文讨论 2026 年前端测试的最佳实践和常见陷阱。"
wordCount: 561
---

前端测试已经从"可选的善后工作"变成了"必备的工程实践"。Vitest 3.0 在 2026 年成为了前端测试的事实标准，提供了比 Jest 更快的速度和更好的 ESM 支持。

## 快照测试的正确用法

快照测试是检测 UI 回归的有效手段，但需要正确使用：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import UserCard from './UserCard.vue';

describe('UserCard', () => {
  it('渲染默认状态', () => {
    const { container } = render(UserCard, {
      props: {
        name: 'Alice',
        role: 'Admin',
        avatar: '/avatar.jpg'
      }
    });
    expect(container).toMatchSnapshot();
  });

  it('渲染加载状态', () => {
    const { container } = render(UserCard, {
      props: { loading: true }
    });
    expect(container).toMatchSnapshot();
  });
});
```

快照测试的原则：
1. **快照要小**：只测试关键 UI 结构，不测试样式细节
2. **快照要稳定**：避免包含随机值（时间戳、UUID）
3. **定期审查**：不要盲目接受快照更新

## 组件测试策略

组件测试应该关注行为而非实现：

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import Counter from './Counter.vue';

describe('Counter', () => {
  it('点击增加按钮时计数器加一', async () => {
    render(Counter, { props: { initialValue: 0 } });
    
    const button = screen.getByRole('button', { name: /增加/i });
    await fireEvent.click(button);
    
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('达到最大值时禁用增加按钮', async () => {
    render(Counter, { props: { initialValue: 9, max: 10 } });
    
    const button = screen.getByRole('button', { name: /增加/i });
    await fireEvent.click(button);
    
    expect(button).toBeDisabled();
  });
});
```

## Mock 策略

Mock 应该只在必要时使用：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import UserProfile from './UserProfile.vue';

// Mock API
vi.mock('./api', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn()
}));

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载并显示用户数据', async () => {
    const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
    vi.mocked(getUser).mockResolvedValue(mockUser);

    mount(UserProfile, { props: { userId: 1 } });

    expect(getUser).toHaveBeenCalledWith(1);
    await nextTick();

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
```

Mock 的原则：
- **API 调用必须 Mock**：避免依赖网络
- **外部服务必须 Mock**：数据库、第三方 API
- **内部逻辑尽量不 Mock**：测试真实行为

## 异步测试

异步测试是前端测试的难点：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/vue';
import DataList from './DataList.vue';

describe('DataList', () => {
  it('加载完成后显示数据', async () => {
    const mockData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ];
    
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockData)
    });

    render(DataList);

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });
});
```

## 覆盖率报告

Vitest 3.0 的覆盖率报告更准确：

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.spec.ts',
        'src/**/*.test.ts'
      ]
    }
  }
});
```

覆盖率的目标不是 100%，而是关键路径的覆盖：
- **语句覆盖率 > 80%**：大部分代码被执行过
- **分支覆盖率 > 70%**：主要条件分支被测试
- **函数覆盖率 > 90%**：所有公共函数都有测试

## 测试组织

测试文件应该与源文件保持对应：

```
src/
  components/
    UserCard.vue
    UserCard.spec.ts
  composables/
    useAuth.ts
    useAuth.spec.ts
  utils/
    formatDate.ts
    formatDate.spec.ts
```

测试描述应该清晰表达预期行为：

```typescript
describe('formatDate', () => {
  it('格式化 ISO 日期字符串为本地格式', () => {
    expect(formatDate('2026-06-11T16:00:00Z')).toBe('2026年6月11日');
  });

  it('空字符串返回空字符串', () => {
    expect(formatDate('')).toBe('');
  });

  it('无效日期返回原始字符串', () => {
    expect(formatDate('invalid')).toBe('invalid');
  });
});
```

## 测试性能

Vitest 已经很快，但大规模测试仍需优化：

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // 并行测试
    threads: true,
    
    // 测试文件匹配
    include: ['src/**/*.spec.ts'],
    
    // 设置文件
    setupFiles: ['./src/test-setup.ts'],
    
    // 超时设置
    testTimeout: 10000
  }
});
```

优化策略：
1. **减少 I/O**：使用内存文件系统 Mock 文件操作
2. **避免重复渲染**：使用 `beforeEach` 复用组件
3. **并行执行**：独立测试并行运行
4. **按需 Mock**：只 Mock 必要的依赖

## 测试驱动开发（TDD）

TDD 在前端同样适用：

```typescript
// 1. 写一个失败的测试
it('验证邮箱格式', () => {
  expect(validateEmail('test@example.com')).toBe(true);
  expect(validateEmail('invalid')).toBe(false);
});

// 2. 写最少的代码让测试通过
function validateEmail(email: string): boolean {
  return email.includes('@');
}

// 3. 重构代码
function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
```

## 小结

Vitest 3.0 让前端测试变得更快、更容易。快照测试检测 UI 回归，组件测试验证行为，Mock 隔离外部依赖。2026 年的测试原则：测试行为不测试实现，Mock 只在必要时使用，覆盖率关注关键路径。好的测试不是覆盖率高，而是能在重构时提供信心。
