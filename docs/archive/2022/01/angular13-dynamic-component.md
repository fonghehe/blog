---
title: "Angular 13 动态组件 API 简化：告别 ComponentFactoryResolver"
date: 2022-01-02 14:50:06
tags:
  - Angular
readingTime: 2
description: "Angular 13 最低调但最实用的变化之一，是彻底简化了动态创建组件的 API。以前需要三个步骤才能动态渲染组件，现在一行代码就够了。这篇文章通过几个实际场景展示新 API 的用法。"
---

Angular 13 最低调但最实用的变化之一，是彻底简化了动态创建组件的 API。以前需要三个步骤才能动态渲染组件，现在一行代码就够了。这篇文章通过几个实际场景展示新 API 的用法。

## 旧 API 的繁琐

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

`ComponentFactoryResolver` 在 Angular 13 中标记为废弃（deprecated），但仍然可用，不会报错。

## 实际场景：动态 Toast 通知

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

## 实际场景：路由级弹窗（无需路由配置）

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

## NgComponentOutlet 指令

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

注意：`inputs` 参数是 Angular 14 才正式支持的（Angular 13 的 `NgComponentOutlet` 还不支持），这里仅作预览。

## 迁移建议

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

## 总结

Angular 13 的动态组件 API 简化虽然是"小"改变，但消除了一个长期困扰 Angular 开发者的 API 繁琐问题。`ComponentFactoryResolver` 作为历史遗留彻底退出舞台，代码更简洁，也更符合直觉。