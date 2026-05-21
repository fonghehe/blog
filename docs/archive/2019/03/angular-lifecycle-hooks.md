---
title: "Angular 生命周期钩子详解"
date: 2019-03-25 15:35:11
tags:
  - Angular
readingTime: 1
description: "Angular 组件的生命周期钩子让你在关键时机执行初始化、清理等操作。"
wordCount: 69
---

Angular 组件的生命周期钩子让你在关键时机执行初始化、清理等操作。

## 钩子执行顺序

```
ngOnChanges → ngOnInit → ngDoCheck → 
ngAfterContentInit → ngAfterContentChecked →
ngAfterViewInit → ngAfterViewChecked → ngOnDestroy
```

## 常用钩子

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
    // DOM 渲染完成后初始化图表
    this.initChart(this.canvas.nativeElement);
  }
}
```

正确使用生命周期钩子是避免内存泄漏和错误初始化的基础。