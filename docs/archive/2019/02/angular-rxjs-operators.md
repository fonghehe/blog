---
title: "RxJS 操作符实战：前端异步流的正确姿势"
date: 2019-02-10 10:12:25
tags:
  - Angular
readingTime: 1
description: "RxJS 6 与 Angular 深度集成，掌握核心操作符是写出健壮响应式代码的基础。"
wordCount: 86
---

RxJS 6 与 Angular 深度集成，掌握核心操作符是写出健壮响应式代码的基础。

## 常用操作符

### switchMap：取消旧请求

```typescript
this.searchInput.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(term => this.searchService.search(term))
).subscribe(results => this.results = results);
```

### combineLatest：合并多个流

```typescript
combineLatest([this.user$, this.settings$]).pipe(
  map(([user, settings]) => ({ ...user, theme: settings.theme }))
).subscribe(profile => this.profile = profile);
```

### takeUntil：避免内存泄漏

```typescript
export class MyComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.dataService.getData().pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.data = data);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## 总结

`switchMap`、`combineLatest`、`takeUntil` 是 Angular 开发中最常用的三个操作符，理解其语义能解决 90% 的异步场景。