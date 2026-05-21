---
title: "Angular Change Detection: Optimizing Performance with OnPush Strategy"
date: 2019-04-16 10:45:08
tags:
  - Angular
readingTime: 1
description: "Angular's default change detection checks all components. The OnPush strategy can significantly reduce unnecessary checks."
wordCount: 52
---

Angular's default change detection checks all components. The OnPush strategy can significantly reduce unnecessary checks.

## Default vs OnPush

```typescript
// Default: checks the entire tree on any event
@Component({ changeDetection: ChangeDetectionStrategy.Default })

// OnPush: only checks when Input reference changes, an event fires, or an async pipe emits
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
```

## Requirements for Using OnPush

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>{{ user.name }}</div>
    <div>{{ count$ | async }}</div>
  `,
})
export class UserCardComponent {
  @Input() user: User; // use immutable data
  count$ = this.store.select(selectCount); // use Observable
}
```

## Manual Triggering

When you truly need to trigger detection manually:

```typescript
constructor(private cdr: ChangeDetectorRef) {}

refresh() {
  this.cdr.markForCheck();  // mark the path from current component to root as needing check
  // or
  this.cdr.detectChanges(); // immediately check the current subtree
}
```

Using OnPush together with immutable data (Immutable.js or Immer) can bring Angular application rendering performance close to that of React.
