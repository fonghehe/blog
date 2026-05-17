---
title: "Angularライフサイクルフック詳解"
date: 2019-03-25 15:35:11
tags:
  - Angular
readingTime: 1
description: "Angularコンポーネントのライフサイクルフックにより、初期化、クリーンアップ、その他の操作を重要なタイミングで実行できる。"
---

Angularコンポーネントのライフサイクルフックにより、初期化、クリーンアップ、その他の操作を重要なタイミングで実行できる。

## フックの実行順序

```
ngOnChanges → ngOnInit → ngDoCheck →
ngAfterContentInit → ngAfterContentChecked →
ngAfterViewInit → ngAfterViewChecked → ngOnDestroy
```

## よく使うフック

### ngOnInit

```typescript
export class UserListComponent implements OnInit {
  users: User[] = [];

  ngOnInit() {
    this.userService.getUsers().subscribe((u) => (this.users = u));
  }
}
```

### ngOnChanges

```typescript
export class ChildComponent implements OnChanges {
  @Input() data: string;

  ngOnChanges(changes: SimpleChanges) {
    if (changes["data"]) {
      console.log("dataが変わりました:", changes["data"].currentValue);
    }
  }
}
```

### ngOnDestroy

```typescript
export class DataComponent implements OnDestroy {
  private sub = Subscription.EMPTY;

  ngOnInit() {
    this.sub = this.dataService.stream$.subscribe(...);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
```

### ngAfterViewInit

```typescript
export class ChartComponent implements AfterViewInit {
  @ViewChild("canvas") canvas: ElementRef;

  ngAfterViewInit() {
    // DOMレンダリング完了後にチャートを初期化
    this.initChart(this.canvas.nativeElement);
  }
}
```

ライフサイクルフックを正しく使うことは、メモリリークと誤った初期化を避けるための基礎だ。
