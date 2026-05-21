---
title: "Angular CDK Overlay：カスタムポップアップレイヤーシステムの構築"
date: 2021-04-02 14:50:20
tags:
  - Angular
  - TypeScript

readingTime: 2
description: "Angular CDK 的 Overlay 模块提供了创建弹出层（Tooltip、Popover、Dropdown、自定义 Dialog）的底层能力。相比直接操作 DOM 或用第三方库，CDK Overlay 与 Angular 的依赖注入、变更检测完美集成，是构建组件库的理想基础。"
wordCount: 198
---

Angular CDK 的 Overlay 模块提供了创建弹出层（Tooltip、Popover、Dropdown、自定义 Dialog）的底层能力。相比直接操作 DOM 或用第三方库，CDK Overlay 与 Angular 的依赖注入、变更检测完美集成，是构建组件库的理想基础。

## インストール

```bash
npm install @angular/cdk
```

## コアコンセプト

```
Overlay（入口服务）
  └── OverlayRef（单个弹出层的引用）
        ├── PositionStrategy（定位策略）
        │     ├── GlobalPositionStrategy（全局定位，如居中 Modal）
        │     └── ConnectedPositionStrategy（相对锚点定位，如 Dropdown）
        └── ScrollStrategy（滚动行为）
              ├── CloseScrollStrategy（滚动时关闭）
              ├── BlockScrollStrategy（锁定滚动）
              └── RepositionScrollStrategy（滚动时重新定位）
```

## 基本的な使い方：カスタム Tooltip

```typescript
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";

@Directive({ selector: "[appTooltip]" })
export class TooltipDirective implements OnDestroy {
  @Input("appTooltip") tooltipText = "";
  @ViewChild("tooltipTemplate") tooltipTemplate!: TemplateRef<any>;

  private overlayRef: OverlayRef | null = null;

  constructor(
    private overlay: Overlay,
    private elementRef: ElementRef,
    private viewContainerRef: ViewContainerRef,
  ) {}

  @HostListener("mouseenter")
  show() {
    if (this.overlayRef) return;

    // 创建定位策略：相对于宿主元素，显示在上方
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions([
        {
          originX: "center",
          originY: "top",
          overlayX: "center",
          overlayY: "bottom",
          offsetY: -8,
        },
        {
          originX: "center",
          originY: "bottom",
          overlayX: "center",
          overlayY: "top",
          offsetY: 8,
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
    });

    const portal = new TemplatePortal(
      this.tooltipTemplate,
      this.viewContainerRef,
    );
    this.overlayRef.attach(portal);
  }

  @HostListener("mouseleave")
  hide() {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  ngOnDestroy() {
    this.overlayRef?.dispose();
  }
}
```

```html
<!-- tooltip.directive.ts 关联的模板 -->
<ng-template #tooltipTemplate>
  <div class="tooltip">{{ tooltipText }}</div>
</ng-template>

<!-- 使用 -->
<button [appTooltip]="'这是提示信息'">悬停我</button>
```

## カスタム Dropdown コンポーネント

```typescript
@Component({
  selector: "app-dropdown",
  template: `
    <button #trigger (click)="toggle()">
      {{ selectedLabel || placeholder }}
      <mat-icon>arrow_drop_down</mat-icon>
    </button>

    <ng-template #dropdownPanel>
      <div class="dropdown-panel" [@dropdownAnimation]>
        <div
          *ngFor="let option of options"
          class="dropdown-option"
          [class.selected]="option.value === value"
          (click)="select(option)"
        >
          {{ option.label }}
        </div>
      </div>
    </ng-template>
  `,
})
export class DropdownComponent implements OnDestroy {
  @Input() options: { label: string; value: any }[] = [];
  @Input() placeholder = "请选择";
  @Output() valueChange = new EventEmitter<any>();

  @ViewChild("trigger") trigger!: ElementRef;
  @ViewChild("dropdownPanel") panelTemplate!: TemplateRef<any>;

  value: any = null;
  private overlayRef: OverlayRef | null = null;

  get selectedLabel() {
    return this.options.find((o) => o.value === this.value)?.label;
  }

  constructor(
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
  ) {}

  toggle() {
    this.overlayRef ? this.close() : this.open();
  }

  open() {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.trigger)
      .withPositions([
        {
          originX: "start",
          originY: "bottom",
          overlayX: "start",
          overlayY: "top",
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: "cdk-overlay-transparent-backdrop",
      minWidth: this.trigger.nativeElement.offsetWidth,
    });

    // 点击背景关闭
    this.overlayRef.backdropClick().subscribe(() => this.close());

    const portal = new TemplatePortal(
      this.panelTemplate,
      this.viewContainerRef,
    );
    this.overlayRef.attach(portal);
  }

  close() {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  select(option: { label: string; value: any }) {
    this.value = option.value;
    this.valueChange.emit(this.value);
    this.close();
  }

  ngOnDestroy() {
    this.overlayRef?.dispose();
  }
}
```

## グローバルセンタリングModal

```typescript
openModal() {
  const positionStrategy = this.overlay.position().global()
    .centerHorizontally()
    .centerVertically();

  const overlayRef = this.overlay.create({
    positionStrategy,
    hasBackdrop: true,
    backdropClass: 'dark-backdrop',
    scrollStrategy: this.overlay.scrollStrategies.block()  // 锁定背景滚动
  });

  const portal = new ComponentPortal(MyModalComponent);
  const ref = overlayRef.attach(portal);

  // 传递数据给 Modal 组件
  ref.instance.data = { title: '确认操作' };
  ref.instance.close.subscribe(() => overlayRef.dispose());

  overlayRef.backdropClick().subscribe(() => overlayRef.dispose());
}
```

## まとめ

Angular CDK Overlay 是构建各类弹出层的瑞士军刀。掌握 `ConnectedPositionStrategy` 和 `backdropClick`，就能实现 Tooltip、Dropdown、Popover 等所有常见弹出交互。相比使用第三方 UI 库里的具体组件，CDK 给了你更大的定制空间，同时保持了与 Angular 生态的完整兼容。