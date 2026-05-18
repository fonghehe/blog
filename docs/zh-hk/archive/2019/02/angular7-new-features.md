---
title: "Angular 7 新特性速覽"
date: 2018-10-05 17:06:11
tags:
  - Angular
readingTime: 1
description: "Angular 7 於 2018 年 10 月正式發佈，帶來了虛擬滾動、拖拽 CDK、性能優化等重要改進。本文梳理最值得關注的新特性。"
---

Angular 7 於 2018 年 10 月正式發佈，帶來了虛擬滾動、拖拽 CDK、性能優化等重要改進。本文梳理最值得關注的新特性。

## 虛擬滾動 Virtual Scrolling

`@angular/cdk/scrolling` 提供的虛擬滾動，僅渲染可見區域的列表項，大幅提升大列表性能：

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

## 性能改進

- 應用包體積平均減少 30-40%
- CLI 提示與錯誤信息更友好
- 升級依賴：TypeScript 3.1+，RxJS 6.3+

## 總結

Angular 7 更新相對穩健，虛擬滾動和拖拽 CDK 是開箱即用的亮點，適合大型企業應用。
