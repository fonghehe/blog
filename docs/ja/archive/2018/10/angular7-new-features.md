---
title: "Angular 7 リリース：CLI Prompts、虚拟滚动与性能提升"
date: 2018-10-05 17:06:11
tags:
  - Angular
readingTime: 1
description: "Angular 7 は 2018 年 10 月に正式リリースされ、仮想スクロール、ドラッグ＆ドロップ CDK、パフォーマンス改善などの重要な機能が追加されました。注目すべき新機能をまとめます。"
wordCount: 293
---

Angular 7 は 2018 年 10 月に正式リリースされ、仮想スクロール、ドラッグ＆ドロップ CDK、パフォーマンス改善などの重要な機能が追加されました。注目すべき新機能をまとめます。

## 仮想スクロール Virtual Scrolling

`@angular/cdk/scrolling` が提供する仮想スクロールは、表示範囲内のリストアイテムのみをレンダリングし、大規模リストのパフォーマンスを大幅に向上させます：

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

## ドラッグ＆ドロップ CDK DragDrop

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

## パフォーマンス改善

- アプリのバンドルサイズが平均 30〜40% 削減
- CLI のヒントとエラーメッセージが改善
- 依存関係のアップグレード：TypeScript 3.1+、RxJS 6.3+

## まとめ

Angular 7 のアップデートは比較的安定しており、仮想スクロールとドラッグ＆ドロップ CDK はそのまま使える注目機能で、大規模なエンタープライズアプリケーションに適しています。
