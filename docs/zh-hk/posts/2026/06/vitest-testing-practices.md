---
title: "Vitest 3.0 快照測試與組件測試最佳實踐"
date: 2026-06-11 10:58:36
tags:
  - 測試
readingTime: 2
description: "Vitest 3.0 帶來了更快的快照測試、更好的組件測試支持和改進的覆蓋率報告。本文討論 2026 年前端測試的最佳實踐和常見陷阱。"
wordCount: 261
---

前端測試已經從「可選的善後工作」變成了「必備的工程實踐」。Vitest 3.0 在 2026 年成為了前端測試的事實標準，提供了比 Jest 更快的速度和更好的 ESM 支持。

## 快照測試的正確用法

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import UserCard from './UserCard.vue';

describe('UserCard', () => {
  it('渲染默認狀態', () => {
    const { container } = render(UserCard, {
      props: {
        name: 'Alice',
        role: 'Admin',
        avatar: '/avatar.jpg'
      }
    });
    expect(container).toMatchSnapshot();
  });

  it('渲染加載狀態', () => {
    const { container } = render(UserCard, {
      props: { loading: true }
    });
    expect(container).toMatchSnapshot();
  });
});
```

快照測試的原則：
1. **快照要小**：只測試關鍵 UI 結構，不測試樣式細節
2. **快照要穩定**：避免包含隨機值（時間戳、UUID）
3. **定期審查**：不要盲目接受快照更新

## 組件測試策略

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import Counter from './Counter.vue';

describe('Counter', () => {
  it('點擊增加按鈕時計數器加一', async () => {
    render(Counter, { props: { initialValue: 0 } });
    
    const button = screen.getByRole('button', { name: /增加/i });
    await fireEvent.click(button);
    
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('達到最大值時禁用增加按鈕', async () => {
    render(Counter, { props: { initialValue: 9, max: 10 } });
    
    const button = screen.getByRole('button', { name: /增加/i });
    await fireEvent.click(button);
    
    expect(button).toBeDisabled();
  });
});
```

## Mock 策略

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

  it('加載並顯示用戶數據', async () => {
    const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
    vi.mocked(getUser).mockResolvedValue(mockUser);

    mount(UserProfile, { props: { userId: 1 } });

    expect(getUser).toHaveBeenCalledWith(1);
    await nextTick();

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
```

## 覆蓋率報告

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

## 測試組織

測試文件應該與源文件保持對應：

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

## 總結

Vitest 3.0 讓前端測試變得更快、更容易。快照測試檢測 UI 回歸，組件測試驗證行為，Mock 隔離外部依賴。2026 年的測試原則：測試行為不測試實現，Mock 只在必要時使用，覆蓋率關注關鍵路徑。好的測試不是覆蓋率高，而是能在重構時提供信心。
