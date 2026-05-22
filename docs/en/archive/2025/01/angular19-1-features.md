---
title: "Angular 19.1: Incremental Hydration Stabilization and linkedSignal Progress"
date: 2025-01-02 16:56:33
tags:
  - Angular
readingTime: 2
description: "Angular 19.1 was released in January 2025, the first minor version in the Angular 19 series. The focus is on advancing the experimental features introduced in A"
wordCount: 213
---

Angular 19.1 was released in January 2025, the first minor version in the Angular 19 series. The focus is on advancing the experimental features introduced in Angular 19 toward stability: Incremental Hydration has moved to a stable Developer Preview, the `linkedSignal()` API has been revised based on feedback, and Zoneless mode continues to be refined.

## Incremental Hydration: From Experimental to Developer Preview

Angular 19.0's incremental hydration was marked as experimental. Angular 19.1 incorporated community feedback and improved it, promoting it to Developer Preview:

```typescript
// Recommended approach since 19.1 (same API as 19.0, but more stable)
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

Key issues fixed in 19.1:

```html
<!-- Known issue in 19.0: unstable hydration order when @defer blocks are nested -->
<!-- 19.1 fix: nested @defer hydration order is now correct -->
@defer (hydrate on viewport) {
<outer-component>
  @defer (hydrate on interaction) {
  <inner-component />
  <!-- In 19.0 this could hydrate before outer; fixed in 19.1 -->
  }
</outer-component>
}
```

## linkedSignal: API Simplification and Improved Documentation

After community trial, the Angular team made minor adjustments to `linkedSignal()`:

```typescript
// Both forms from 19.0 are retained (short format and object format)
import { linkedSignal } from "@angular/core";

// Short format (most common): recomputes when source changes
const selectedItem = linkedSignal(() => items()[0] ?? null);

// Object format (when you need access to the previous value):
const currentPage = linkedSignal<number>({
  source: () => ({ query: searchQuery(), pageSize: pageSize() }),
  computation: (source, previous) => {
    // Reset to page 1 when query changes, otherwise retain current page
    if (!previous || previous.source.query !== source.query) return 1;
    return Math.min(previous.value, Math.ceil(totalItems() / source.pageSize));
  },
});

// New in 19.1: linkedSignal can now accept an initial value argument (instead of relying on the source function)
const count = linkedSignal({
  source: externalCount, // Signal<number>
  computation: (val) => val * 2,
});
```

## Signal Effect Cleanup Mechanism Improvements

Angular 19.1 improved the resource cleanup API for `effect()`:

```typescript
import { effect, inject, DestroyRef } from '@angular/core';

@Component({ standalone: true, ... })
export class DataStreamComponent {
  private ws: WebSocket | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      const url = this.wsUrl();
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onmessage = (evt) => this.messages.update(m => [...m, evt.data]);

      // 19.1 improvement: onCleanup type is more accurate, supports async cleanup functions
      onCleanup(() => {
        ws.close();
        this.ws = null;
      });
    });
  }

  messages = signal<string[]>([]);
  wsUrl = input.required<string>();
}
```

## Enhanced Template Type Checking

Angular 19.1 enhances type checking for Signal expressions:

```typescript
@Component({
  standalone: true,
  template: `
    <!-- Before 19.1: the compiler couldn't precisely check types for nested Signal access -->
    <!-- After 19.1: precisely infers the type of user()?.profile?.avatar -->
    <img [src]="user()?.profile?.avatar ?? defaultAvatar" />

    <!-- @for track expressions also benefit from improved type inference -->
    @for (item of items(); track item.id) {
      {{ item.name }}
    }
  `,
})
export class UserCardComponent {
  user = input<User | null>(null);
  items = input.required<{ id: string; name: string }[]>();
  defaultAvatar = "/assets/default-avatar.png";
}
```

## Upgrading to 19.1

```bash
ng update @angular/core@19.1 @angular/cli@19.1

# View the changelog
npx ng-update --list
```

The Angular 19.x series releases minor versions on a monthly cadence (19.1 → 19.2 → 19.3), each building stability toward Angular 20 (expected May 2025).

## Summary

Angular 19.1 is a "consolidation" release — promoting Incremental Hydration to Developer Preview means it can now be validated in pre-production environments, and the `linkedSignal` API is more polished. If you held back from Incremental Hydration in Angular 19.0 due to its experimental label, 19.1 is a good time to start evaluating it.
