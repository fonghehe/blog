---
title: "AngularとRxJS：コンポーネント通信におけるリアクティブプログラミング実践"
date: 2018-07-26 17:32:04
tags:
  - Angular
readingTime: 2
description: "AngularはRxJSを生まれながらに深く統合しています。HttpClient、EventEmitter、RouterはすべてObservableに基づいています。RxJSオペレーターをマスターすることで、非同期処理とコンポーネント通信をよりエレガントに実装できます。"
---

AngularはRxJSを生まれながらに深く統合しています。HttpClient、EventEmitter、RouterはすべてObservableに基づいています。RxJSオペレーターをマスターすることで、非同期処理とコンポーネント通信をよりエレガントに実装できます。

## AngularがRxJSを選んだ理由

- 統一された非同期モデル：HTTPリクエスト、タイマー、DOMイベントはすべてストリーム
- 強力な合成能力：`switchMap`、`combineLatest`などのオペレーター
- 組み込みのキャンセル（unsubscribe）でメモリリークを防止

## 実践的なオペレーターの使い方

### switchMap：検索のデバウンス

```typescript
{% raw %}
@Component({
  template: `<input [formControl]="searchCtrl" placeholder="検索" />
    <div *ngFor="let result of results$ | async">{{ result.name }}</div>`,
})
export class SearchComponent implements OnInit {
  searchCtrl = new FormControl("");
  results$: Observable<SearchResult[]>;

  constructor(private searchService: SearchService) {}

  ngOnInit() {
    this.results$ = this.searchCtrl.valueChanges.pipe(
      debounceTime(300), // 入力停止後300msでリクエスト
      distinctUntilChanged(), // 値が変わらなければリクエストしない
      switchMap(
        (
          query, // 新しいリクエストで前のリクエストが自動キャンセル
        ) => (query ? this.searchService.search(query) : of([])),
      ),
    );
  }
}
{% endraw %}
```

### combineLatest：複数のデータストリームの合成

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

## コンポーネント間通信にSubjectを使う

`BehaviorSubject`で共有状態サービスを作り、シンプルなシナリオではNgRxの代わりに使えます：

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

## メモリリーク対策

コンポーネント破棄時にサブスクリプションを必ずキャンセルしましょう。`takeUntil`で一元管理するのがおすすめです：

```typescript
export class MyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000)
      .pipe(
        takeUntil(this.destroy$), // コンポーネント破棄時に自動完了
      )
      .subscribe((n) => console.log(n));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## asyncパイプが最善

テンプレートで`async`パイプを使うと、Angularがサブスクリプションとキャンセルを自動管理します。手動のsubscribeよりも安全です：

```html
{% raw %}
<!-- ✅ asyncパイプは自動的にunsubscribeする -->
<div *ngIf="user$ | async as user">{{ user.name }}</div>

<!-- ❌ 手動subscribeはキャンセルし忘れやすい -->
{% endraw %}
```

## まとめ

RxJSはAngular開発の中核スキルです。`switchMap`で検索、`combineLatest`でデータ集約、`BehaviorSubject`で状態共有——この3つのパターンを押さえれば、日常的なリアクティブ要件の80%に対応できます。
