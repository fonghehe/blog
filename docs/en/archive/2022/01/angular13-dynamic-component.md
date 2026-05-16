---
title: "Angular 13 Dynamic Component API Simplified: Goodbye ComponentFactoryResolver"
date: 2022-01-02 14:50:06
tags:
  - Angular
readingTime: 2
description: "One of the most understated but practical changes in Angular 13 is the complete simplification of the dynamic component creation API. Previously it took three s"
---

One of the most understated but practical changes in Angular 13 is the complete simplification of the dynamic component creation API. Previously it took three steps to dynamically render a component; now one line of code is enough. This article demonstrates the new API through several real-world scenarios.

## The Cumbersome Old API

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

## Angular 13 New API

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

`ComponentFactoryResolver` is marked as deprecated in Angular 13 but still works without errors.

## Real-World Scenario: Dynamic Toast Notification

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

## Real-World Scenario: Route-Level Modal (No Route Config Needed)

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

## NgComponentOutlet Directive

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

Note: The `inputs` parameter is officially supported only in Angular 14 (not yet supported by Angular 13's `NgComponentOutlet`); this is shown here as a preview.

## Migration Recommendations

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

## Summary

Although Angular 13's dynamic component API simplification is a "small" change, it eliminates a long-standing cumbersome API issue for Angular developers. `ComponentFactoryResolver` is completely retired as a legacy artifact, making the code cleaner and more intuitive.