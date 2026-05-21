---
title: "Angular CDK ドラッグ＆ドロップソートと仮想スクロールの実践"
date: 2018-11-30 16:45:11
tags:
  - Angular
readingTime: 2
description: "Angular 7 の正式リリース後、CDK の Drag and Drop と Virtual Scrolling はすぐに最も人気のある機能となりました。本記事では実際のプロジェクトを通じてこの 2 つの機能を深く解説します。"
wordCount: 451
---

Angular 7 の正式リリース後、CDK の Drag and Drop と Virtual Scrolling はすぐに最も人気のある機能となりました。本記事では実際のプロジェクトを通じてこの 2 つの機能を深く解説します。

## ドラッグ＆ドロップソート：タスクかんばん

### インストール

```bash
npm install @angular/cdk
```

### 単一列ドラッグソート

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
    { id: 1, title: "要件分析", priority: "high" },
    { id: 2, title: "UIデザイン", priority: "medium" },
    { id: 3, title: "フロントエンド開発", priority: "high" },
    { id: 4, title: "API連携", priority: "medium" },
    { id: 5, title: "テストとリリース", priority: "low" },
  ];

  drop(event: CdkDragDrop<Task[]>) {
    moveItemInArray(this.tasks, event.previousIndex, event.currentIndex);
    this.saveOrder(); // 新しい順序を永続化
  }

  saveOrder() {
    const order = this.tasks.map((t, i) => ({ id: t.id, sort: i }));
    this.taskService.updateOrder(order).subscribe();
  }
}
{% endraw %}
```

### マルチ列かんばん（列間ドラッグ）

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
    // タスクのステータスを更新
    const task = event.container.data[event.currentIndex];
    const newStatus = this.getColumnStatus(event.container.id);
    this.taskService.updateStatus(task.id, newStatus).subscribe();
  }
}
```

## 仮想スクロール：大量データリスト

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
  // 10万件でも UIはスムーズ
  items: User[] = generateLargeDataset(100000);
}
{% endraw %}
```

**重要なパラメータ：**

- `itemSize`：各項目の高さ（px）。固定高さの場合パフォーマンスが最良
- 高さが固定でない場合は `AutoSizeVirtualScrollStrategy`（実験的）を使用

## ドラッグ＆ドロップ + 仮想スクロールの注意点

両者を組み合わせる際に制限があります：`cdkVirtualFor` が生成する DOM ノードは動的なため、`cdkDrag` と直接組み合わせるとオフセット計算に問題が生じます。推奨事項：

- データ件数 < 500：`*ngFor` + `cdkDrag` を直接使用
- データ件数 > 500：ページネーションで読み込み、仮想スクロールとドラッグの混在を避ける

## まとめ

Angular CDK の Drag and Drop モジュールは非常によく設計されており、かんばんアプリの実装はほぼ追加コード不要です。仮想スクロールは大量データリストの標準的な解決策です。この 2 つの API を習得すれば、エンタープライズアプリの多くの UI インタラクションの課題を解決できます。
