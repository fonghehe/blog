---
title: "Angular 生命週期鈎子詳解：落地路徑與實戰建議"
date: 2019-03-25 15:35:11
tags:
  - Angular
readingTime: 1
description: "Angular 組件的生命週期鈎子讓你在關鍵時機執行初始化、清理等操作。"
wordCount: 69
---

Angular 組件的生命週期鈎子讓你在關鍵時機執行初始化、清理等操作。

## 鈎子執行順序

```
ngOnChanges → ngOnInit → ngDoCheck → 
ngAfterContentInit → ngAfterContentChecked →
ngAfterViewInit → ngAfterViewChecked → ngOnDestroy
```

## 常用鈎子

### ngOnInit

```typescript
export class UserListComponent implements OnInit {
  users: User[] = [];

  ngOnInit() {
    this.userService.getUsers().subscribe(u => this.users = u);
  }
}
```

### ngOnChanges

```typescript
export class ChildComponent implements OnChanges {
  @Input() data: string;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      console.log('data changed:', changes['data'].currentValue);
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
  @ViewChild('canvas') canvas: ElementRef;

  ngAfterViewInit() {
    // DOM 渲染完成後初始化圖表
    this.initChart(this.canvas.nativeElement);
  }
}
```

正確使用生命週期鈎子是避免內存泄漏和錯誤初始化的基礎。