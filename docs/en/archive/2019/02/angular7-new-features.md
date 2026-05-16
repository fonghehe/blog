---
title: "Angular 7 New Features at a Glance"
date: 2018-10-05 17:06:11
tags:
  - Angular
readingTime: 1
description: "Angular 7 was officially released in October 2018, bringing important improvements including virtual scrolling, a drag-and-drop CDK, and performance optimizatio"
---

Angular 7 was officially released in October 2018, bringing important improvements including virtual scrolling, a drag-and-drop CDK, and performance optimizations. Here is a summary of the most noteworthy new features.

## Virtual Scrolling

The virtual scrolling provided by `@angular/cdk/scrolling` renders only visible list items, significantly improving performance with large lists:

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

## Drag-and-Drop CDK DragDrop

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

- Application bundle size reduced by an average of 30–40%
- CLI prompts and error messages are friendlier
- Updated dependencies: TypeScript 3.1+, RxJS 6.3+

## Summary

Angular 7's updates are relatively stable. Virtual scrolling and the drag-and-drop CDK are the standout out-of-the-box features, well-suited for large enterprise applications.
