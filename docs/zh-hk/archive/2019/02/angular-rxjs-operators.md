---
title: "RxJS 操作符實戰：前端異步流的正確姿勢"
date: 2019-02-10 10:12:25
tags:
  - Angular
readingTime: 1
description: "RxJS 6 與 Angular 深度集成，掌握核心操作符是寫出健壯響應式代碼的基礎。"
---

RxJS 6 與 Angular 深度集成，掌握核心操作符是寫出健壯響應式代碼的基礎。

## 常用操作符

### switchMap：取消舊請求

```typescript
this.searchInput.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(term => this.searchService.search(term))
).subscribe(results => this.results = results);
```

### combineLatest：合併多個流

```typescript
combineLatest([this.user$, this.settings$]).pipe(
  map(([user, settings]) => ({ ...user, theme: settings.theme }))
).subscribe(profile => this.profile = profile);
```

### takeUntil：避免內存泄漏

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

## 總結

`switchMap`、`combineLatest`、`takeUntil` 是 Angular 開發中最常用的三個操作符，理解其語義能解決 90% 的異步場景。