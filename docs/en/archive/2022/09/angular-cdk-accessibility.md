---
title: "Angular CDK A11y: Building Accessible Components"
date: 2022-09-28 10:22:48
tags:
  - Angular
readingTime: 2
description: "Accessibility (a11y) is an area where many frontend teams have long-standing debt. Angular CDK provides a comprehensive set of a11y tools, including focus management, keyboard navigation, screen reader support, and more. This article covers the core APIs of the CDK A11y module."
wordCount: 182
---

Accessibility (a11y) is an area where many frontend teams have long-standing debt. Angular CDK provides a comprehensive set of a11y tools, including focus management, keyboard navigation, screen reader support, and more. This article covers the core APIs of the CDK A11y module.

## Installation and Configuration

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

## FocusTrap: Modal Focus Trapping

When opening a modal, focus should be "trapped" inside it to prevent users from tabbing to content behind it:

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

The `cdkTrapFocus` directive automatically handles focus trapping, and `cdkTrapFocusAutoCapture` auto-focuses the first focusable element when the modal opens.

## LiveAnnouncer: Live Screen Reader Announcements

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

`polite` = wait until the current announcement finishes before notifying; `assertive` = interrupt immediately and notify (used for errors and other critical information).

## FocusMonitor: Tracking Focus Origin

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

## Keyboard Navigation: ListKeyManager

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

## High Contrast Mode Detection

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

## Summary

The Angular CDK A11y module provides the low-level tools needed to build accessible components — focus trapping, screen reader announcements, focus origin detection, and keyboard navigation management. These capabilities are especially important in custom component libraries. Accessibility is not just a nice-to-have — it's already a legal requirement in an increasing number of countries and regions.