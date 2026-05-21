---
title: "Angular and RxJS: Reactive Programming in Component Communication"
date: 2018-07-26 17:32:04
tags:
  - Angular
readingTime: 2
description: "Angular has deeply integrated RxJS since its inception — HttpClient, EventEmitter, and Router are all based on Observables. Mastering RxJS operators lets you ha"
wordCount: 161
---

Angular has deeply integrated RxJS since its inception — HttpClient, EventEmitter, and Router are all based on Observables. Mastering RxJS operators lets you handle async operations and component communication more elegantly.

## Why Angular Chose RxJS

- Unified async model: HTTP requests, timers, and DOM events are all streams
- Powerful composition: operators like `switchMap` and `combineLatest`
- Built-in cancellation (unsubscribe) to prevent memory leaks

## Common Operators in Practice

### switchMap: Search Debouncing

```typescript
{% raw %}
@Component({
  template: `<input [formControl]="searchCtrl" placeholder="Search" />
    <div *ngFor="let result of results$ | async">{{ result.name }}</div>`,
})
export class SearchComponent implements OnInit {
  searchCtrl = new FormControl("");
  results$: Observable<SearchResult[]>;

  constructor(private searchService: SearchService) {}

  ngOnInit() {
    this.results$ = this.searchCtrl.valueChanges.pipe(
      debounceTime(300), // wait 300ms after user stops typing
      distinctUntilChanged(), // don't send if value hasn't changed
      switchMap(
        (
          query, // new request automatically cancels the previous one
        ) => (query ? this.searchService.search(query) : of([])),
      ),
    );
  }
}
{% endraw %}
```

### combineLatest: Merging Multiple Data Streams

```typescript
export class DashboardComponent implements OnInit {
  vm$: Observable<ViewModel>;

  constructor(
    private userService: UserService,
    private statsService: StatsService,
  ) {}

  ngOnInit() {
    this.vm$ = combineLatest([
      this.userService.currentUser$,
      this.statsService.stats$,
    ]).pipe(map(([user, stats]) => ({ user, stats })));
  }
}
```

## Using Subject for Cross-Component Communication

Wrap a `BehaviorSubject` as a shared state service to replace NgRx in simpler scenarios:

```typescript
@Injectable({ providedIn: "root" })
export class CartService {
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  get count$() {
    return this.items$.pipe(map((items) => items.length));
  }

  addItem(item: CartItem) {
    const current = this.itemsSubject.getValue();
    this.itemsSubject.next([...current, item]);
  }

  removeItem(id: string) {
    const current = this.itemsSubject.getValue();
    this.itemsSubject.next(current.filter((i) => i.id !== id));
  }
}
```

## Preventing Memory Leaks

Always unsubscribe when a component is destroyed. Use `takeUntil` for unified management:

```typescript
export class MyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000)
      .pipe(
        takeUntil(this.destroy$), // auto-completes when component is destroyed
      )
      .subscribe((n) => console.log(n));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## async Pipe is Preferred

Use the `async` pipe in templates to let Angular automatically manage subscriptions and unsubscriptions — safer than manually subscribing:

```html
{% raw %}
<!-- ✅ async pipe auto-unsubscribes -->
<div *ngIf="user$ | async as user">{{ user.name }}</div>

<!-- ❌ manual subscribe is easy to forget to clean up -->
{% endraw %}
```

## Summary

RxJS is a core skill for Angular development. `switchMap` for search, `combineLatest` for aggregating data, `BehaviorSubject` for shared state — mastering these three patterns handles 80% of everyday reactive requirements.
