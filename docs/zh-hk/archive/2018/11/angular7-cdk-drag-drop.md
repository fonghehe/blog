---
title: "Angular CDK 拖拽排序與虛擬滾動實戰"
date: 2018-11-30 16:45:11
tags:
  - Angular
readingTime: 2
description: "Angular 7 正式發佈後，CDK 中的 Drag and Drop 和 Virtual Scrolling 迅速成為最受歡迎的特性。本文用實際項目案例深入講解這兩個功能。"
wordCount: 268
---

Angular 7 正式發佈後，CDK 中的 Drag and Drop 和 Virtual Scrolling 迅速成為最受歡迎的特性。本文用實際項目案例深入講解這兩個功能。

## 拖拽排序：任務看板

### 安裝

```bash
npm install @angular/cdk
```

### 單列拖拽排序

```typescript
{% raw %}
import { DragDropModule } from "@angular/cdk/drag-drop";

@Component({
  selector: "app-sortable-list",
  template: `
    <div cdkDropList class="task-list" (cdkDropListDropped)="drop($event)">
      <div *ngFor="let task of tasks" cdkDrag class="task-item">
        <mat-icon cdkDragHandle>drag_handle</mat-icon>
        <span>{{ task.title }}</span>
        <span class="badge" [ngClass]="task.priority">{{ task.priority }}</span>
      </div>
    </div>
  `,
})
export class SortableListComponent {
  tasks: Task[] = [
    { id: 1, title: "需求分析", priority: "high" },
    { id: 2, title: "UI 設計", priority: "medium" },
    { id: 3, title: "前端開發", priority: "high" },
    { id: 4, title: "接口聯調", priority: "medium" },
    { id: 5, title: "測試上線", priority: "low" },
  ];

  drop(event: CdkDragDrop<Task[]>) {
    moveItemInArray(this.tasks, event.previousIndex, event.currentIndex);
    this.saveOrder(); // 持久化新順序
  }

  saveOrder() {
    const order = this.tasks.map((t, i) => ({ id: t.id, sort: i }));
    this.taskService.updateOrder(order).subscribe();
  }
}
{% endraw %}
```

### 多列看板（跨列拖拽）

```html
{% raw %}
<div class="kanban-board">
  <div
    *ngFor="let column of columns"
    cdkDropList
    [cdkDropListData]="column.tasks"
    [cdkDropListConnectedTo]="getConnectedLists(column)"
    (cdkDropListDropped)="onDrop($event)"
  >
    <h3>{{ column.title }}</h3>
    <div *ngFor="let task of column.tasks" cdkDrag>{{ task.title }}</div>
  </div>
</div>
{% endraw %}
```

```typescript
onDrop(event: CdkDragDrop<Task[]>) {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    // 更新任務狀態
    const task = event.container.data[event.currentIndex];
    const newStatus = this.getColumnStatus(event.container.id);
    this.taskService.updateStatus(task.id, newStatus).subscribe();
  }
}
```

## 虛擬滾動：大數據列表

```typescript
{% raw %}
@Component({
  template: `
    <cdk-virtual-scroll-viewport
      itemSize="60"
      style="height: 500px; overflow-y: auto"
    >
      <mat-list-item
        *cdkVirtualFor="let item of items; let i = index"
        class="list-item"
      >
        <mat-icon mat-list-icon>person</mat-icon>
        <h4 mat-line>{{ item.name }}</h4>
        <p mat-line>{{ item.email }}</p>
      </mat-list-item>
    </cdk-virtual-scroll-viewport>
  `,
})
export class VirtualUserListComponent {
  // 即使 10 萬條，UI 也流暢
  items: User[] = generateLargeDataset(100000);
}
{% endraw %}
```

**關鍵參數：**

- `itemSize`：每項高度（px），固定高度時性能最佳
- 若高度不固定，使用 `AutoSizeVirtualScrollStrategy`（實驗性）

## 拖拽 + 虛擬滾動注意事項

兩者結合時有一個限制：`cdkVirtualFor` 生成的 DOM 節點是動態的，直接和 `cdkDrag` 結合會有 offset 計算問題。建議：

- 數據量 < 500 條：直接 `*ngFor` + `cdkDrag`
- 數據量 > 500 條：分頁加載，而不是虛擬滾動 + 拖拽混用

## 總結

Angular CDK 的 Drag and Drop 模塊設計得非常完善，看板類應用幾乎不需要額外代碼。虛擬滾動則是大數據列表的標配方案，學會這兩個 API，能解決企業應用中大量的 UI 交互挑戰。
