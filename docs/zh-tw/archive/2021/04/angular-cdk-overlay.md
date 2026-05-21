---
title: "Angular CDK Overlay：構建自定義彈出層系統"
date: 2021-04-02 14:50:20
tags:
  - Angular
  - TypeScript
readingTime: 2
description: "Angular CDK 的 Overlay 模組提供了建立彈出層（Tooltip、Popover、Dropdown、自定義 Dialog）的底層能力。相比直接操作 DOM 或用第三方庫，CDK Overlay 與 Angular 的依賴注入、變更檢測完美整合，是構建元件庫的理想基礎。"
wordCount: 174
---

Angular CDK 的 Overlay 模組提供了建立彈出層（Tooltip、Popover、Dropdown、自定義 Dialog）的底層能力。相比直接操作 DOM 或用第三方庫，CDK Overlay 與 Angular 的依賴注入、變更檢測完美整合，是構建元件庫的理想基礎。

## 安裝

```bash
npm install @angular/cdk
```

## 核心概念

```
Overlay（入口服務）
  └── OverlayRef（單個彈出層的引用）
        ├── PositionStrategy（定位策略）
        │     ├── GlobalPositionStrategy（全域性定位，如居中 Modal）
        │     └── ConnectedPositionStrategy（相對錨點定位，如 Dropdown）
        └── ScrollStrategy（滾動行為）
              ├── CloseScrollStrategy（滾動時關閉）
              ├── BlockScrollStrategy（鎖定滾動）
              └── RepositionScrollStrategy（滾動時重新定位）
```

## 基礎用法：自定義 Tooltip

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

    // 建立定位策略：相對於宿主元素，顯示在上方
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
<!-- tooltip.directive.ts 關聯的模板 -->
<ng-template #tooltipTemplate>
  <div class="tooltip">{{ tooltipText }}</div>
</ng-template>

<!-- 使用 -->
<button [appTooltip]="'這是提示資訊'">懸停我</button>
```

## 自定義 Dropdown 元件

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
  @Input() placeholder = "請選擇";
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

    // 點選背景關閉
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

## 全域性居中 Modal

```typescript
openModal() {
  const positionStrategy = this.overlay.position().global()
    .centerHorizontally()
    .centerVertically();

  const overlayRef = this.overlay.create({
    positionStrategy,
    hasBackdrop: true,
    backdropClass: 'dark-backdrop',
    scrollStrategy: this.overlay.scrollStrategies.block()  // 鎖定背景滾動
  });

  const portal = new ComponentPortal(MyModalComponent);
  const ref = overlayRef.attach(portal);

  // 傳遞資料給 Modal 元件
  ref.instance.data = { title: '確認操作' };
  ref.instance.close.subscribe(() => overlayRef.dispose());

  overlayRef.backdropClick().subscribe(() => overlayRef.dispose());
}
```

## 總結

Angular CDK Overlay 是構建各類彈出層的瑞士軍刀。掌握 `ConnectedPositionStrategy` 和 `backdropClick`，就能實現 Tooltip、Dropdown、Popover 等所有常見彈出互動。相比使用第三方 UI 庫裡的具體元件，CDK 給了你更大的定製空間，同時保持了與 Angular 生態的完整相容。