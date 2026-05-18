---
title: "Angular 13 動態元件 API 簡化：告別 ComponentFactoryResolver"
date: 2022-01-02 14:50:06
tags:
  - Angular
readingTime: 2
description: "Angular 13 最低調但最實用的變化之一，是徹底簡化了動態建立元件的 API。以前需要三個步驟才能動態渲染元件，現在一行程式碼就夠了。這篇文章通過幾個實際場景展示新 API 的用法。"
---

Angular 13 最低調但最實用的變化之一，是徹底簡化了動態建立元件的 API。以前需要三個步驟才能動態渲染元件，現在一行程式碼就夠了。這篇文章通過幾個實際場景展示新 API 的用法。

## 舊 API 的繁瑣

```typescript
// Angular 12 及之前：動態建立元件需要 ComponentFactoryResolver
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
    // 第一步：獲取 Factory
    const factory = this.resolver.resolveComponentFactory(type);
    // 第二步：用 Factory 建立
    const ref = this.container.createComponent(factory);
    // 第三步：操作例項
    ref.instance.data = "hello";
  }
}
```

## Angular 13 新 API

```typescript
// Angular 13：直接傳元件類
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
    // 直接設定 inputs
    if (inputs) {
      Object.assign(ref.instance, inputs);
    }
    ref.changeDetectorRef.detectChanges();
    return ref;
  }
}
```

`ComponentFactoryResolver` 在 Angular 13 中標記為廢棄（deprecated），但仍然可用，不會報錯。

## 實際場景：動態 Toast 通知

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

    // 3 秒後自動銷燬
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

## 實際場景：路由級彈窗（無需路由配置）

```typescript
// 點選彈出詳情，不改變 URL
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

## NgComponentOutlet 指令

對於模板驅動的動態元件，`NgComponentOutlet` 也做了同步更新，支援 inputs：

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

注意：`inputs` 引數是 Angular 14 才正式支援的（Angular 13 的 `NgComponentOutlet` 還不支援），這裡僅作預覽。

## 遷移建議

```typescript
// 舊程式碼（Angular 12 以下）
const factory = this.resolver.resolveComponentFactory(MyComponent);
const ref = this.container.createComponent(factory);

// 新程式碼（Angular 13+）
const ref = this.container.createComponent(MyComponent);

// 如果有 injector 需要傳遞
const ref = this.container.createComponent(MyComponent, {
  injector: this.injector,
  environmentInjector: this.environmentInjector,
});
```

## 總結

Angular 13 的動態元件 API 簡化雖然是"小"改變，但消除了一個長期困擾 Angular 開發者的 API 繁瑣問題。`ComponentFactoryResolver` 作為歷史遺留徹底退出舞臺，程式碼更簡潔，也更符合直覺。