---
title: "Angular 変更検知：OnPush戦略によるパフォーマンス最適化"
date: 2019-04-16 10:45:08
tags:
  - Angular
readingTime: 1
description: "Angularのデフォルト変更検知はすべてのコンポーネントをチェックします。OnPush戦略を使うと、不要なチェックを大幅に削減できます。"
---

Angularのデフォルト変更検知はすべてのコンポーネントをチェックします。OnPush戦略を使うと、不要なチェックを大幅に削減できます。

## Default vs OnPush

```typescript
// Default：任意のイベント発生時にツリー全体をチェック
@Component({ changeDetection: ChangeDetectionStrategy.Default })

// OnPush：Inputの参照変化、イベント発生、async pipeの値出力時のみチェック
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
```

## OnPushを使う条件

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>{{ user.name }}</div>
    <div>{{ count$ | async }}</div>
  `,
})
export class UserCardComponent {
  @Input() user: User; // イミュータブルデータを使用
  count$ = this.store.select(selectCount); // Observableを使用
}
```

## 手動トリガー

本当に手動で変更検知をトリガーする必要がある場合：

```typescript
constructor(private cdr: ChangeDetectorRef) {}

refresh() {
  this.cdr.markForCheck();  // 現在のコンポーネントからルートへのパスをチェック対象としてマーク
  // または
  this.cdr.detectChanges(); // 現在のサブツリーを即時チェック
}
```

イミュータブルデータ（Immutable.jsやImmer）とOnPushを組み合わせることで、AngularアプリケーションのレンダリングパフォーマンスをReactに近づけることができます。
