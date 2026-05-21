---
title: "RxJSオペレーター実践：フロントエンド非同期ストリームの正しい扱い方"
date: 2019-02-10 10:12:25
tags:
  - Angular
readingTime: 1
description: "RxJS 6はAngularと深く統合されている。コアオペレーターをマスターすることが、堅牢なリアクティブコードを書く基礎となる。"
wordCount: 149
---

RxJS 6はAngularと深く統合されている。コアオペレーターをマスターすることが、堅牢なリアクティブコードを書く基礎となる。

## よく使うオペレーター

### switchMap：古いリクエストをキャンセル

```typescript
this.searchInput.valueChanges
  .pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((term) => this.searchService.search(term)),
  )
  .subscribe((results) => (this.results = results));
```

### combineLatest：複数のストリームをマージ

```typescript
combineLatest([this.user$, this.settings$])
  .pipe(map(([user, settings]) => ({ ...user, theme: settings.theme })))
  .subscribe((profile) => (this.profile = profile));
```

### takeUntil：メモリリークを防ぐ

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

## まとめ

`switchMap`、`combineLatest`、`takeUntil`はAngular開発で最もよく使われる3つのオペレーターだ。その意味を理解することで、非同期シナリオの90%を解決できる。
