---
title: "Angular 17.2：Signalベースクエリの開発者プレビュー"
date: 2024-02-14 11:13:38
tags:
  - Angular
readingTime: 3
description: "Angular 17.2 は2024年2月14日にリリースされ、Signal-based Queries の開発者プレビューがもたらされました。Angular 17.1 で Signal Inputs（input() 関数）が導入されたのに続き、17.2 では Signal 化の範囲がテンプレートクエリに拡張されました：viewChild()、viewChildren()、contentChild()、contentChildren() の各関数です。"
wordCount: 541
---

Angular 17.2 は2024年2月14日にリリースされ、Signal-based Queries の開発者プレビューがもたらされました。Angular 17.1 で Signal Inputs（`input()` 関数）が導入されたのに続き、17.2 では Signal 化の範囲がテンプレートクエリに拡張されました：`viewChild()`、`viewChildren()`、`contentChild()`、`contentChildren()` です。

これは Angular チームがコンポーネント API 全体を Signal エコシステムに移行する重要な一歩です。

## 旧デコレータークエリ

```typescript
import {
  Component,
  ViewChild,
  ContentChild,
  ElementRef,
  AfterViewInit,
} from "@angular/core";

@Component({
  selector: "app-demo",
  template: `<div #container>...</div>`,
})
export class OldDemoComponent implements AfterViewInit {
  @ViewChild("container") container!: ElementRef; // 初期は undefined、AfterViewInit 後に値が設定される
  @ContentChild("slot") slot?: ElementRef;

  ngAfterViewInit() {
    // AfterViewInit までアクセスできない
    console.log(this.container.nativeElement);
  }
}
```

この方法には問題点があります。クエリ結果がリアクティブではなく、`ngAfterViewInit` の前にアクセスすると `undefined` になり、`computed()` や `effect()` で追跡できません。

## Signal ベースクエリ（Angular 17.2）

```typescript
import {
  Component,
  viewChild,
  viewChildren,
  contentChild,
  ElementRef,
  signal,
} from "@angular/core";

@Component({
  standalone: true,
  selector: "app-demo",
  template: `
    <div #container>...</div>
    <button #btn *ngFor="let b of buttons()">{{ b }}</button>
  `,
})
export class NewDemoComponent {
  // viewChild は Signal<ElementRef | undefined> を返す
  container = viewChild<ElementRef>("container");

  // required：要素が存在しない場合はエラーをスロー、Signal<ElementRef>（undefined ではない）を返す
  containerRequired = viewChild.required<ElementRef>("container");

  // viewChildren は Signal<readonly ElementRef[]> を返す
  buttons = viewChildren<ElementRef>("btn");

  // constructor で直接使用可能（AfterViewInit を待つ必要はない）
  // ただし注意：コンポーネントのマウント前は、viewChild() の値は undefined です
  constructor() {
    // effect 内で自動追跡
    effect(() => {
      const el = this.container();
      if (el) {
        console.log("container mounted:", el.nativeElement);
      }
    });
  }
}
```

## contentChild と contentChildren

```typescript
@Component({
  standalone: true,
  selector: "app-panel",
  template: `<ng-content></ng-content>`,
})
export class PanelComponent {
  // 投影されたコンテンツをクエリ
  header = contentChild<HeaderComponent>(HeaderComponent);
  items = contentChildren<ItemComponent>(ItemComponent);

  constructor() {
    // items が変更されると自動的に反応
    effect(() => {
      console.log(`Panel has ${this.items().length} items`);
    });
  }
}

// PanelComponent を使用
@Component({
  template: `
    <app-panel>
      <app-header>Title</app-header>
      <app-item *ngFor="let i of list">{{ i }}</app-item>
    </app-panel>
  `,
})
export class AppComponent {}
```

## Signal Queries と computed() の組み合わせ

これは Signal-based Queries の最大の利点です——派生計算値を作成できます：

```typescript
@Component({
  standalone: true,
  selector: "app-form",
  template: `
    <input #nameInput type="text" />
    <input #emailInput type="email" />
    <button [disabled]="!isFormValid()">提交</button>
  `,
})
export class FormComponent {
  nameInput = viewChild.required<ElementRef<HTMLInputElement>>("nameInput");
  emailInput = viewChild.required<ElementRef<HTMLInputElement>>("emailInput");

  // DOM クエリに基づいて計算値を派生
  isFormValid = computed(() => {
    const name = this.nameInput().nativeElement.value;
    const email = this.emailInput().nativeElement.value;
    return name.length > 0 && email.includes("@");
  });
}
```

## Angular 17.x Signal 移行ロードマップ

```
Angular 17.0 (2023-11)  Signals 開発者プレビュー → 安定版
                         signal(), computed(), effect()

Angular 17.1 (2024-01)  Signal Inputs
                         input(), input.required()

Angular 17.2 (2024-02)  Signal Queries  ← 本文
                         viewChild(), viewChildren(), contentChild(), contentChildren()

Angular 17.3 (2024-03 予定)  Output API
                         output(), output.required()

Angular 18.0 (2024-05 予定)  Zoneless 変更検出（実験的）
                         コンポーネントの完全 Signal 化
```

## 旧デコレーターとの互換性

Angular 17.2 の Signal Queries は**開発者プレビュー**段階であり、API は正式版で調整される可能性があります。従来の `@ViewChild` や `@ContentChild` などのデコレータは引き続き動作し、廃止されることはありません（少なくとも Angular 18 までは）。新しいコンポーネントで Signal Queries を段階的に採用でき、一括移行は必要ありません。

## まとめ

Angular 17.2 の Signal Queries により、テンプレートクエリもリアクティブシステムに統合され、`ngAfterViewInit` ライフサイクルフックへの依存がなくなり、クエリ結果が `computed()` の導出チェーンに直接参加できるようになりました。Signal Inputs と組み合わせることで、Angular コンポーネントのデータフローはより純粋関数に近づいています：入力 → 信号 → テンプレート、これにより認知的負荷が大幅に軽減されます。
