---
title: "Angular 7 Release: CLI Prompts, Virtual Scrolling, and Performance Improvements"
date: 2018-10-05 17:06:11
tags:
  - Angular
readingTime: 1
description: "Angular 7 was officially released in October 2018, bringing important improvements such as virtual scrolling, a drag-and-drop CDK, and performance enhancements. Here are the new features worth highlighting."
wordCount: 105
---

Angular 7 was officially released in October 2018, bringing important improvements such as virtual scrolling, a drag-and-drop CDK, and performance enhancements. Here are the new features worth highlighting.

## Virtual Scrolling

`@angular/cdk/scrolling` provides virtual scrolling, which renders only the list items in the visible area and significantly improves the performance of large lists:

```typescript
{% raw %}
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" style="height: 400px">
      <div *cdkVirtualFor="let item of items">{{ item }}</div>
    </cdk-virtual-scroll-viewport>
  `
})
export class AppComponent {
  items = Array.from({ length: 10000 }, (_, i) => `Item #${i}`);
}
{% endraw %}
```

## Drag and Drop CDK

```typescript
{% raw %}
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  template: `
    <div cdkDropList (cdkDropListDropped)="drop($event)">
      <div *ngFor="let item of items" cdkDrag>{{ item }}</div>
    </div>
  `
})
export class DragListComponent {
  items = ['Apple', 'Banana', 'Cherry'];
  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.items, event.previousIndex, event.currentIndex);
  }
}
{% endraw %}
```

## Performance Improvements

- App bundle size reduced by an average of 30–40%
- CLI prompts and error messages are more helpful
- Dependency upgrades: TypeScript 3.1+, RxJS 6.3+

## Summary

Angular 7 is a stable update; virtual scrolling and the drag-and-drop CDK are ready-to-use highlights. It is well suited to large enterprise applications.
