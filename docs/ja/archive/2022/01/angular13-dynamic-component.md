---
title: "Angular 13 動的コンポーネント API 簡素化：ComponentFactoryResolver とのお別れ"
date: 2022-01-02 14:50:06
tags:
  - Angular
readingTime: 3
description: "Angular 13 で最も地味でありながら最も実用的な変更の一つは、動的コンポーネント作成 API の完全な簡素化です。以前はコンポーネントを動的にレンダリングするのに3ステップが必要でしたが、今は1行のコードで十分です。この記事では、いくつかの実際のシナリオを通じて新しい API の使い方を紹介します。"
wordCount: 407
---

Angular 13 で最も地味でありながら最も実用的な変更の一つは、動的コンポーネント作成 API の完全な簡素化です。以前はコンポーネントを動的にレンダリングするのに3ステップが必要でしたが、今は1行のコードで十分です。この記事では、いくつかの実際のシナリオを通じて新しい API の使い方を紹介します。

## 旧 API の煩雑さ

```typescript
// Angular 12 及之前：动态创建组件需要 ComponentFactoryResolver
@Component({
  selector: "app-host",
  template: "<ng-container #container></ng-container>",
})
export class HostComponent {
  @ViewChild("container", { read: ViewContainerRef })
  container!: ViewContainerRef;

  constructor(private resolver: ComponentFactoryResolver) {}

  loadComponent(type: Type<any>) {
    this.container.clear();
    // 第一步：获取 Factory
    const factory = this.resolver.resolveComponentFactory(type);
    // 第二步：用 Factory 创建
    const ref = this.container.createComponent(factory);
    // 第三步：操作实例
    ref.instance.data = "hello";
  }
}
```

## Angular 13 新 API

```typescript
// Angular 13：直接传组件类
@Component({
  selector: "app-host",
  template: "<ng-container #container></ng-container>",
})
export class HostComponent {
  @ViewChild("container", { read: ViewContainerRef })
  container!: ViewContainerRef;

  loadComponent(type: Type<any>, inputs?: Record<string, any>) {
    this.container.clear();
    const ref = this.container.createComponent(type);
    // 直接设置 inputs
    if (inputs) {
      Object.assign(ref.instance, inputs);
    }
    ref.changeDetectorRef.detectChanges();
    return ref;
  }
}
```

`ComponentFactoryResolver` は Angular 13 で非推奨（deprecated）としてマークされていますが、エラーなしで引き続き使用できます。

## 実際のシナリオ：動的 Toast 通知

```typescript
// notification.service.ts
@Injectable({ providedIn: "root" })
export class NotificationService {
  private container?: ViewContainerRef;

  setContainer(ref: ViewContainerRef) {
    this.container = ref;
  }

  show(message: string, type: "success" | "error" | "warning" = "success") {
    if (!this.container) return;

    const ref = this.container.createComponent(ToastComponent);
    ref.instance.message = message;
    ref.instance.type = type;
    ref.changeDetectorRef.detectChanges();

    // 3 秒后自动销毁
    setTimeout(() => {
      ref.destroy();
    }, 3000);
  }
}

// toast.component.ts
@Component({
  selector: "app-toast",
  template: ` <div class="toast" [class]="type">{{ message }}</div> `,
})
export class ToastComponent {
  message = "";
  type: "success" | "error" | "warning" = "success";
}
```

## 実際のシナリオ：ルートレベルモーダル（ルート設定不要）

```typescript
// 点击弹出详情，不改变 URL
@Component({
  selector: "app-list",
  template: `
    <div *ngFor="let item of items" (click)="openDetail(item)">
      {{ item.name }}
    </div>
    <ng-container #modalHost></ng-container>
  `,
})
export class ListComponent {
  @ViewChild("modalHost", { read: ViewContainerRef })
  modalHost!: ViewContainerRef;

  items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];

  openDetail(item: any) {
    this.modalHost.clear();
    const ref = this.modalHost.createComponent(DetailModalComponent);
    ref.instance.item = item;
    ref.instance.close.subscribe(() => {
      ref.destroy();
    });
  }
}
```

## NgComponentOutlet ディレクティブ

对于模板驱动的动态组件，`NgComponentOutlet` 也做了同步更新，支持 inputs：

```html
<!-- Angular 13 的 NgComponentOutlet -->
<ng-container
  *ngComponentOutlet="currentComponent; inputs: componentInputs"
></ng-container>
```

```typescript
export class DynamicPageComponent {
  currentComponent: Type<any> = HomeComponent;
  componentInputs = { userId: 123 };

  navigateTo(component: Type<any>, inputs: any) {
    this.currentComponent = component;
    this.componentInputs = inputs;
  }
}
```

注意：`inputs` パラメータは Angular 14 で正式にサポートされます（Angular 13 の `NgComponentOutlet` はまだサポートしていません）。ここではプレビューとして示します。

## 移行の推奨事項

```typescript
// 旧代码（Angular 12 以下）
const factory = this.resolver.resolveComponentFactory(MyComponent);
const ref = this.container.createComponent(factory);

// 新代码（Angular 13+）
const ref = this.container.createComponent(MyComponent);

// 如果有 injector 需要传递
const ref = this.container.createComponent(MyComponent, {
  injector: this.injector,
  environmentInjector: this.environmentInjector,
});
```

## まとめ

Angular 13 の動的コンポーネント API の簡素化は「小さな」変更ではありますが、Angular 開発者を長年悩ませてきた API の煩雑さを解消しました。`ComponentFactoryResolver` はレガシーとして完全に退場し、コードはよりシンプルで直感的になりました。