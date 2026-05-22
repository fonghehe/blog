---
title: "Angular 7 发布：CLI Prompts、虚拟滚动与性能提升"
date: 2018-10-05 17:06:11
tags:
  - Angular
readingTime: 1
description: "Angular 7 于 2018 年 10 月正式发布，带来了虚拟滚动、拖拽 CDK、性能优化等重要改进。本文梳理最值得关注的新特性。"
wordCount: 151
---

Angular 7 于 2018 年 10 月正式发布，带来了虚拟滚动、拖拽 CDK、性能优化等重要改进。本文梳理最值得关注的新特性。

## 虚拟滚动 Virtual Scrolling

`@angular/cdk/scrolling` 提供的虚拟滚动，仅渲染可见区域的列表项，大幅提升大列表性能：

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

## 拖拽 CDK DragDrop

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

## 性能改进

- 应用包体积平均减少 30-40%
- CLI 提示与错误信息更友好
- 升级依赖：TypeScript 3.1+，RxJS 6.3+

## 总结

Angular 7 更新相对稳健，虚拟滚动和拖拽 CDK 是开箱即用的亮点，适合大型企业应用。
