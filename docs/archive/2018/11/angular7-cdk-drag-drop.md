---
title: "Angular CDK 拖拽排序与虚拟滚动实战"
date: 2018-11-30 16:45:11
tags:
  - Angular
readingTime: 2
description: "Angular 7 正式发布后，CDK 中的 Drag and Drop 和 Virtual Scrolling 迅速成为最受欢迎的特性。本文用实际项目案例深入讲解这两个功能。"
---

Angular 7 正式发布后，CDK 中的 Drag and Drop 和 Virtual Scrolling 迅速成为最受欢迎的特性。本文用实际项目案例深入讲解这两个功能。

## 拖拽排序：任务看板

### 安装

```bash
npm install @angular/cdk
```

### 单列拖拽排序

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
    { id: 2, title: "UI 设计", priority: "medium" },
    { id: 3, title: "前端开发", priority: "high" },
    { id: 4, title: "接口联调", priority: "medium" },
    { id: 5, title: "测试上线", priority: "low" },
  ];

  drop(event: CdkDragDrop<Task[]>) {
    moveItemInArray(this.tasks, event.previousIndex, event.currentIndex);
    this.saveOrder(); // 持久化新顺序
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
    // 更新任务状态
    const task = event.container.data[event.currentIndex];
    const newStatus = this.getColumnStatus(event.container.id);
    this.taskService.updateStatus(task.id, newStatus).subscribe();
  }
}
```

## 虚拟滚动：大数据列表

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
  // 即使 10 万条，UI 也流畅
  items: User[] = generateLargeDataset(100000);
}
{% endraw %}
```

**关键参数：**

- `itemSize`：每项高度（px），固定高度时性能最佳
- 若高度不固定，使用 `AutoSizeVirtualScrollStrategy`（实验性）

## 拖拽 + 虚拟滚动注意事项

两者结合时有一个限制：`cdkVirtualFor` 生成的 DOM 节点是动态的，直接和 `cdkDrag` 结合会有 offset 计算问题。建议：

- 数据量 < 500 条：直接 `*ngFor` + `cdkDrag`
- 数据量 > 500 条：分页加载，而不是虚拟滚动 + 拖拽混用

## 总结

Angular CDK 的 Drag and Drop 模块设计得非常完善，看板类应用几乎不需要额外代码。虚拟滚动则是大数据列表的标配方案，学会这两个 API，能解决企业应用中大量的 UI 交互挑战。
