---
title: "Vitest 3.0 Snapshot Testing and Component Testing Best Practices"
date: 2026-06-11 10:58:36
tags:
  - Testing
readingTime: 2
description: "Vitest 3.0 brings faster snapshot testing, better component testing support, and improved coverage reports. This article discusses 2026 frontend testing best practices and common pitfalls."
wordCount: 181
---

Frontend testing has evolved from "optional cleanup work" to "essential engineering practice." Vitest 3.0 became the de facto standard for frontend testing in 2026, providing faster speed and better ESM support than Jest.

## Correct Usage of Snapshot Testing

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import UserCard from './UserCard.vue';

describe('UserCard', () => {
  it('renders default state', () => {
    const { container } = render(UserCard, {
      props: {
        name: 'Alice',
        role: 'Admin',
        avatar: '/avatar.jpg'
      }
    });
    expect(container).toMatchSnapshot();
  });

  it('renders loading state', () => {
    const { container } = render(UserCard, {
      props: { loading: true }
    });
    expect(container).toMatchSnapshot();
  });
});
```

Snapshot testing principles:
1. **Snapshots should be small**: Only test key UI structure, not style details
2. **Snapshots should be stable**: Avoid random values (timestamps, UUIDs)
3. **Review regularly**: Don't blindly accept snapshot updates

## Component Testing Strategy

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import Counter from './Counter.vue';

describe('Counter', () => {
  it('increments counter when increment button clicked', async () => {
    render(Counter, { props: { initialValue: 0 } });
    
    const button = screen.getByRole('button', { name: /increment/i });
    await fireEvent.click(button);
    
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('disables increment button when max reached', async () => {
    render(Counter, { props: { initialValue: 9, max: 10 } });
    
    const button = screen.getByRole('button', { name: /increment/i });
    await fireEvent.click(button);
    
    expect(button).toBeDisabled();
  });
});
```

## Mock Strategy

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

  it('loads and displays user data', async () => {
    const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
    vi.mocked(getUser).mockResolvedValue(mockUser);

    mount(UserProfile, { props: { userId: 1 } });

    expect(getUser).toHaveBeenCalledWith(1);
    await nextTick();

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
```

Mock principles:
- **API calls must be mocked**: Avoid network dependency
- **External services must be mocked**: Database, third-party APIs
- **Internal logic should avoid mocking**: Test real behavior

## Coverage Reports

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

Coverage targets aren't 100%, but coverage of critical paths:
- **Statement coverage > 80%**: Most code executed
- **Branch coverage > 70%**: Main conditional branches tested
- **Function coverage > 90%**: All public functions have tests

## Test Organization

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

## Summary

Vitest 3.0 makes frontend testing faster and easier. Snapshot testing detects UI regression, component testing verifies behavior, Mock isolates external dependencies. 2026's testing principles: test behavior not implementation, Mock only when necessary, coverage focuses on critical paths. Good tests provide confidence during refactoring.
