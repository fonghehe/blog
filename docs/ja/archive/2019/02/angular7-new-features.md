---
title: "Angular 7 新機能速覧"
date: 2018-10-05 17:06:11
tags:
  - Angular
readingTime: 1
description: "Angular 7は2018年10月に正式リリースされ、仮想スクロール、ドラッグ＆ドロップCDK、パフォーマンス最適化などの重要な改善をもたらした。最も注目すべき新機能をまとめる。"
wordCount: 295
---

Angular 7は2018年10月に正式リリースされ、仮想スクロール、ドラッグ＆ドロップCDK、パフォーマンス最適化などの重要な改善をもたらした。最も注目すべき新機能をまとめる。

## 仮想スクロール（Virtual Scrolling）

`@angular/cdk/scrolling`が提供する仮想スクロールは、表示領域のリストアイテムのみをレンダリングし、大きなリストのパフォーマンスを大幅に向上させる：

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

- アプリケーションのバンドルサイズが平均30〜40%削減
- CLIのプロンプトとエラーメッセージがより分かりやすく
- 依存関係のアップデート：TypeScript 3.1+、RxJS 6.3+

## まとめ

Angular 7のアップデートは比較的安定している。仮想スクロールとドラッグ＆ドロップCDKはすぐに使えるハイライト機能で、大型のエンタープライズアプリケーションに適している。
