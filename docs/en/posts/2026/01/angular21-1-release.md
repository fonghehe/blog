---
title: "Angular 21.1 Official Release: httpResource Stabilization and Signal Ecosystem Fully Landed"
date: 2026-01-03 19:37:14
tags:
  - Angular
readingTime: 2
description: "Angular 21 reached the milestone of its Signal migration in November 2025, and 21.1, as the first minor release, brought a large amount of ecosystem stabilizati"
wordCount: 290
---

Angular 21 reached the milestone of its Signal migration in November 2025, and 21.1, as the first minor release, brought a large amount of ecosystem stabilization work in January 2026. The most notable highlights are `httpResource` graduating to a stable API, and `linkedSignal` being deeply integrated into complex state management.

## httpResource Fully Stabilized

`httpResource` debuted in Angular 20 as a developer preview. After two major version cycles of refinement, 21.1 marks it as stable. It seamlessly merges HTTP requests with the Signal reactive system:

```typescript
import { httpResource } from "@angular/common/http";
import { computed, signal } from "@angular/core";

@Component({
  selector: "app-user-profile",
  template: `
    @if (userResource.isLoading()) {
      <app-skeleton />
    } @else if (userResource.error()) {
      <p class="error">{{ userResource.error()?.message }}</p>
    } @else {
      <app-user-card [user]="userResource.value()!" />
    }
  `,
})
export class UserProfileComponent {
  userId = signal<number>(1);

  userResource = httpResource<User>(() => ({
    url: `/api/users/${this.userId()}`,
    method: "GET",
  }));

  // Depends on the userId Signal, automatically re-fetches on change
  displayName = computed(() => userResource.value()?.name ?? "Loading...");
}
```

21.1 adds request deduplication and cache strategy configuration:

```typescript
userResource = httpResource<User>(() => `/api/users/${this.userId()}`, {
  // Concurrent requests with the same URL are automatically merged
  deduplicate: true,
  // Cache for 30 seconds
  cache: { ttl: 30_000 },
  // Auto-retry on failure, up to 2 times
  retry: { count: 2, delay: 1000 },
});
```

## linkedSignal in Complex Scenarios

`linkedSignal` solves a classic problem: when a source Signal changes, a derived Signal needs to reset, while still preserving local user modifications.

```typescript
@Component({ template: `...` })
export class PaginatedListComponent {
  pageSize = signal(10);
  currentPage = signal(1);

  // When pageSize changes, automatically reset to page 1.
  // But when the user manually navigates pages, currentPage is not affected by pageSize.
  page = linkedSignal({
    source: this.pageSize,
    computation: () => 1, // Reset to 1 when pageSize changes
  });

  items = httpResource(() => ({
    url: "/api/items",
    params: { page: this.page(), size: this.pageSize() },
  }));

  goToPage(n: number) {
    this.page.set(n); // User action, does not trigger reset
  }

  changePageSize(size: number) {
    this.pageSize.set(size); // Triggers page reset to 1
  }
}
```

## Signal DevTools Enhancements

Angular DevTools received a major upgrade in 21.1 for Signal debugging:

- **Signal dependency graph visualization**: The DevTools panel now gives you an intuitive view of every Signal's dependency relationships
- **Time-travel debugging**: Records Signal state change history, supporting rollback to any snapshot
- **Performance hotspot detection**: Flags frequently triggering computed values and effects, helping identify over-computation

```typescript
// In development mode, this code shows a complete call stack in DevTools
const total = computed(
  () => {
    // DevTools tracks all dependencies of this computed
    return items().reduce((sum, item) => sum + item.price, 0);
  },
  { debugName: "cartTotal" },
); // 21.1 adds the debugName option
```

## Migration Guide: Upgrading from 21.0 to 21.1

```bash
ng update @angular/core@21.1 @angular/cli@21.1
```

21.1 is fully backward compatible. Key changes:

1. Traditional methods like `httpClient.get()` still work, but the IDE will show a "consider migrating to httpResource" hint
2. The `resource()` API's `loader` function now supports `AbortSignal`, making request cancellation more graceful
3. `effect()` scheduling strategy gains a new `microtask` option, suitable for scenarios requiring synchronous awareness

## Summary

Angular 21.1 stabilizes `httpResource` and the Signal toolchain, bringing many "developer preview" features from 2025 into production-ready status. Combined with the enhanced DevTools, the Angular development experience in 2026 is smoother than ever. The next version, 21.2, will focus on improvements to Signal Forms in production practice — worth keeping an eye on.
