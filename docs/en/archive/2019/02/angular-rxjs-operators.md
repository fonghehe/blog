---
title: "RxJS Operators in Practice: The Right Way to Handle Frontend Async Streams"
date: 2019-02-10 10:12:25
tags:
  - Angular
readingTime: 1
description: "RxJS 6 is deeply integrated with Angular. Mastering the core operators is the foundation for writing robust reactive code."
---

RxJS 6 is deeply integrated with Angular. Mastering the core operators is the foundation for writing robust reactive code.

## Common Operators

### switchMap: Cancel Outdated Requests

```typescript
this.searchInput.valueChanges
  .pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((term) => this.searchService.search(term)),
  )
  .subscribe((results) => (this.results = results));
```

### combineLatest: Merge Multiple Streams

```typescript
combineLatest([this.user$, this.settings$])
  .pipe(map(([user, settings]) => ({ ...user, theme: settings.theme })))
  .subscribe((profile) => (this.profile = profile));
```

### takeUntil: Prevent Memory Leaks

```typescript
export class MyComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.dataService
      .getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => (this.data = data));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Summary

`switchMap`, `combineLatest`, and `takeUntil` are the three most-used operators in Angular development. Understanding their semantics solves 90% of async scenarios.
