---
title: "Angular CDK A11y：アクセシブルなコンポーネントの構築"
date: 2022-09-28 10:22:48
tags:
  - Angular
readingTime: 3
description: "无障碍访问（Accessibility，a11y）是很多前端团队长期欠债的领域。Angular CDK 提供了一套完善的 A11y 工具，包括焦点管理、键盘导航、屏幕阅读器支持等。这篇文章介绍 CDK A11y 模块的核心 API。"
---

无障碍访问（Accessibility，a11y）是很多前端团队长期欠债的领域。Angular CDK 提供了一套完善的 A11y 工具，包括焦点管理、键盘导航、屏幕阅读器支持等。这篇文章介绍 CDK A11y 模块的核心 API。

## インストールと設定

```bash
npm install @angular/cdk
```

```typescript
// feature.module.ts 或 standalone 组件
import { A11yModule } from "@angular/cdk/a11y";

@NgModule({
  imports: [A11yModule],
})
export class FeatureModule {}
```

## FocusTrap：モーダルフォーカストラップ

打开模态框时，焦点应该被"困"在模态框内，防止用户 Tab 键跳到后面的内容：

```typescript
import { FocusTrap, FocusTrapFactory } from "@angular/cdk/a11y";

@Component({
  selector: "app-dialog",
  template: `
    <div class="dialog-overlay" (click)="close()">
      <div class="dialog-content" cdkTrapFocus cdkTrapFocusAutoCapture>
        <h2 id="dialog-title">{{ title }}</h2>
        <p id="dialog-desc">{{ message }}</p>
        <button (click)="confirm()">确认</button>
        <button (click)="close()">取消</button>
      </div>
    </div>
  `,
  host: {
    role: "dialog",
    "[attr.aria-labelledby]": '"dialog-title"',
    "[attr.aria-describedby]": '"dialog-desc"',
    "aria-modal": "true",
  },
})
export class DialogComponent {
  @Input() title = "";
  @Input() message = "";
  @Output() confirmed = new EventEmitter<void>();

  confirm() {
    this.confirmed.emit();
    this.close();
  }
  close() {
    /* ... */
  }
}
```

`cdkTrapFocus` 指令自动处理焦点陷阱，`cdkTrapFocusAutoCapture` 让模态框打开时自动聚焦第一个可聚焦元素。

## LiveAnnouncer：スクリーンリーダーへのリアルタイム通知

```typescript
import { LiveAnnouncer } from "@angular/cdk/a11y";

@Component({
  selector: "app-file-upload",
  template: `
    <input type="file" (change)="onFileChange($event)" />
    <div aria-live="polite" aria-atomic="true">{{ status }}</div>
  `,
})
export class FileUploadComponent {
  status = "";
  private liveAnnouncer = inject(LiveAnnouncer);

  async onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.status = "正在上传...";
    // LiveAnnouncer 会让屏幕阅读器朗读这段文字
    await this.liveAnnouncer.announce("文件上传中，请稍候", "polite");

    try {
      await this.uploadFile(file);
      this.status = "上传成功";
      await this.liveAnnouncer.announce(`${file.name} 上传成功`, "assertive");
    } catch {
      this.status = "上传失败";
      await this.liveAnnouncer.announce("文件上传失败，请重试", "assertive");
    }
  }

  private uploadFile(file: File): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
```

`polite` = 等当前内容朗读完再通知；`assertive` = 立即打断并通知（用于错误等重要信息）。

## FocusMonitor：フォーカス元の追跡

```typescript
import { FocusMonitor, FocusOrigin } from "@angular/cdk/a11y";

@Component({
  selector: "app-custom-button",
  template: `
    <button
      [class.keyboard-focused]="focusedByKeyboard"
      (focus)="onFocus()"
      (blur)="onBlur()"
    >
      {{ label }}
    </button>
  `,
})
export class CustomButtonComponent implements AfterViewInit, OnDestroy {
  @ViewChild("button") buttonRef!: ElementRef;
  @Input() label = "";

  focusedByKeyboard = false;

  private focusMonitor = inject(FocusMonitor);
  private elRef = inject(ElementRef);

  ngAfterViewInit() {
    this.focusMonitor.monitor(this.elRef).subscribe((origin: FocusOrigin) => {
      // origin: 'mouse' | 'touch' | 'keyboard' | 'program' | null
      this.focusedByKeyboard = origin === "keyboard";
    });
  }

  ngOnDestroy() {
    this.focusMonitor.stopMonitoring(this.elRef);
  }

  onFocus() {}
  onBlur() {
    this.focusedByKeyboard = false;
  }
}
```

## キーボードナビゲーション：ListKeyManager

```typescript
import { ListKeyManager } from "@angular/cdk/a11y";

@Component({
  selector: "app-custom-select",
  template: `
    <div role="listbox" (keydown)="onKeydown($event)" tabindex="0">
      <div
        *ngFor="let option of options; let i = index"
        role="option"
        [attr.aria-selected]="i === activeIndex"
        [class.active]="i === activeIndex"
      >
        {{ option.label }}
      </div>
    </div>
  `,
})
export class CustomSelectComponent implements AfterViewInit {
  @ViewChildren(OptionItemComponent)
  optionItems!: QueryList<OptionItemComponent>;
  options = [{ label: "选项一" }, { label: "选项二" }, { label: "选项三" }];
  activeIndex = 0;

  private keyManager!: ListKeyManager<OptionItemComponent>;

  ngAfterViewInit() {
    this.keyManager = new ListKeyManager(this.optionItems)
      .withWrap() // 到末尾后循环到开头
      .withTypeAhead(); // 按字母快速定位
  }

  onKeydown(event: KeyboardEvent) {
    this.keyManager.onKeydown(event);
    this.activeIndex = this.keyManager.activeItemIndex ?? 0;
  }
}
```

## ハイコントラストモードの検出

```typescript
import { HighContrastModeDetector } from '@angular/cdk/a11y';

@Component({...})
export class AppComponent {
  private highContrast = inject(HighContrastModeDetector);

  ngOnInit() {
    const mode = this.highContrast.getHighContrastMode();
    if (mode !== 'none') {
      // 用户启用了高对比度模式（Windows 无障碍功能）
      document.body.classList.add('high-contrast-mode');
    }
  }
}
```

## まとめ

Angular CDK A11y 模块提供了构建无障碍组件所需的底层工具——焦点陷阱、屏幕阅读器通知、焦点来源检测、键盘导航管理。这些能力在自定义组件库中尤为重要。无障碍访问不是"锦上添花"，在越来越多的国家和地区已经是法律要求。