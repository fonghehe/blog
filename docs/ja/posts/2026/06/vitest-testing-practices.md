---
title: "Vitest 3.0 スナップショットテストとコンポーネントテストのベストプラクティス"
date: 2026-06-11 10:58:36
tags:
  - テスト
readingTime: 3
description: "Vitest 3.0 はより高速なスナップショットテスト、より良いコンポーネントテストサポート、改善されたカバレッジレポートをもたらす。2026 年のフロントエンドテストのベストプラクティスとよくある陷阱を議論する。"
wordCount: 608
---

フロントエンドテストは「オプションの片付け作業」から「必須のエンジニアリング実践」に進化した。Vitest 3.0 は 2026 年にフロントエンドテストの事実上の標準となり、Jest よりも高速で良い ESM サポートを提供する。

## スナップショットテストの正しい使用法

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import UserCard from './UserCard.vue';

describe('UserCard', () => {
  it('デフォルト状態をレンダリング', () => {
    const { container } = render(UserCard, {
      props: {
        name: 'Alice',
        role: 'Admin',
        avatar: '/avatar.jpg'
      }
    });
    expect(container).toMatchSnapshot();
  });

  it('読み込み状態をレンダリング', () => {
    const { container } = render(UserCard, {
      props: { loading: true }
    });
    expect(container).toMatchSnapshot();
  });
});
```

スナップショットテストの原則：
1. **スナップショットは小さく**：重要な UI 構造のみテストし、スタイル詳細はテストしない
2. **スナップショットは安定**：ランダム値（タイムスタンプ、UUID）を含めない
3. **定期的にレビュー**：スナップショット更新を盲目的に受け入れない

## コンポーネントテスト戦略

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import Counter from './Counter.vue';

describe('Counter', () => {
  it('インクリメントボタンクリックでカウンターが増加', async () => {
    render(Counter, { props: { initialValue: 0 } });
    
    const button = screen.getByRole('button', { name: /increment/i });
    await fireEvent.click(button);
    
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('最大値に達するとインクリメントボタンが無効化', async () => {
    render(Counter, { props: { initialValue: 9, max: 10 } });
    
    const button = screen.getByRole('button', { name: /increment/i });
    await fireEvent.click(button);
    
    expect(button).toBeDisabled();
  });
});
```

## Mock 戦略

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import UserProfile from './UserProfile.vue';

// API を Mock
vi.mock('./api', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn()
}));

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ユーザーデータをロードして表示', async () => {
    const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
    vi.mocked(getUser).mockResolvedValue(mockUser);

    mount(UserProfile, { props: { userId: 1 } });

    expect(getUser).toHaveBeenCalledWith(1);
    await nextTick();

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
```

Mock の原則：
- **API 呼び出しは必ず Mock**：ネットワーク依存を回避
- **外部サービスは必ず Mock**：データベース、サードパーティ API
- **内部ロジックはなるべく Mock しない**：実際の動作をテスト

## カバレッジレポート

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

カバレッジ目標は 100% ではなく、重要なパスのカバレッジ：
- **ステートメントカバレッジ > 80%**：ほとんどのコードが実行された
- **ブランチカバレッジ > 70%**：主要な条件分岐がテストされた
- **関数カバレッジ > 90%**：すべてのパブリック関数にテストがある

## テスト組織

テストファイルはソースファイルに対応させるべき：

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

## まとめ

Vitest 3.0 はフロントエンドテストをより高速で簡単にした。スナップショットテストは UI リグレッションを検出し、コンポーネントテストは動作を検証し、Mock は外部依存を隔離する。2026 年のテスト原則：実装ではなく動作をテストし、必要な場合のみ Mock を使用し、カバレッジは重要なパスに焦点を当てる。良いテストはリファクタリング時に信頼性を提供する。
