---
title: "Angular Lifecycle Hooks Explained"
date: 2019-03-25 15:35:11
tags:
  - Angular
readingTime: 1
description: "Angular component lifecycle hooks let you execute initialization, cleanup, and other operations at key moments."
---

Angular component lifecycle hooks let you execute initialization, cleanup, and other operations at key moments.

## Hook Execution Order

```
ngOnChanges → ngOnInit → ngDoCheck →
ngAfterContentInit → ngAfterContentChecked →
ngAfterViewInit → ngAfterViewChecked → ngOnDestroy
```

## Common Hooks

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
      console.log("data changed:", changes["data"].currentValue);
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
    // Initialize chart after DOM has rendered
    this.initChart(this.canvas.nativeElement);
  }
}
```

Using lifecycle hooks correctly is the foundation for avoiding memory leaks and incorrect initialization.
