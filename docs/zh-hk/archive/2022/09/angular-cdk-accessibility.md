---
title: "Angular CDK A11y：打造無障礙可訪問的組件"
date: 2022-09-28 10:22:48
tags:
  - Angular
readingTime: 2
description: "無障礙訪問（Accessibility，a11y）是很多前端團隊長期欠債的領域。Angular CDK 提供了一套完善的 A11y 工具，包括焦點管理、鍵盤導航、屏幕閲讀器支援等。這篇文章介紹 CDK A11y 模塊的核心 API。"
wordCount: 297
---

無障礙訪問（Accessibility，a11y）是很多前端團隊長期欠債的領域。Angular CDK 提供了一套完善的 A11y 工具，包括焦點管理、鍵盤導航、屏幕閲讀器支持等。這篇文章介紹 CDK A11y 模塊的核心 API。

## 安裝與設定

```bash
npm install @angular/cdk
```

```typescript
// feature.module.ts 或 standalone 組件
import { A11yModule } from "@angular/cdk/a11y";

@NgModule({
  imports: [A11yModule],
})
export class FeatureModule {}
```

## FocusTrap：模態框焦點陷阱

打開模態框時，焦點應該被"困"在模態框內，防止用户 Tab 鍵跳到後面的內容：

```typescript
import { FocusTrap, FocusTrapFactory } from "@angular/cdk/a11y";

@Component({
  selector: "app-dialog",
  template: `
    <div class="dialog-overlay" (click)="close()">
      <div class="dialog-content" cdkTrapFocus cdkTrapFocusAutoCapture>
        <h2 id="dialog-title">{{ title }}</h2>
        <p id="dialog-desc">{{ message }}</p>
        <button (click)="confirm()">確認</button>
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

`cdkTrapFocus` 指令自動處理焦點陷阱，`cdkTrapFocusAutoCapture` 讓模態框打開時自動聚焦第一個可聚焦元素。

## LiveAnnouncer：屏幕閲讀器實時通知

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

    this.status = "正在上傳...";
    // LiveAnnouncer 會讓屏幕閲讀器朗讀這段文字
    await this.liveAnnouncer.announce("文件上傳中，請稍候", "polite");

    try {
      await this.uploadFile(file);
      this.status = "上傳成功";
      await this.liveAnnouncer.announce(`${file.name} 上傳成功`, "assertive");
    } catch {
      this.status = "上傳失敗";
      await this.liveAnnouncer.announce("文件上傳失敗，請重試", "assertive");
    }
  }

  private uploadFile(file: File): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
```

`polite` = 等當前內容朗讀完再通知；`assertive` = 立即打斷並通知（用於錯誤等重要信息）。

## FocusMonitor：監控焦點來源

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

## 鍵盤導航：ListKeyManager

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
  options = [{ label: "選項一" }, { label: "選項二" }, { label: "選項三" }];
  activeIndex = 0;

  private keyManager!: ListKeyManager<OptionItemComponent>;

  ngAfterViewInit() {
    this.keyManager = new ListKeyManager(this.optionItems)
      .withWrap() // 到末尾後循環到開頭
      .withTypeAhead(); // 按字母快速定位
  }

  onKeydown(event: KeyboardEvent) {
    this.keyManager.onKeydown(event);
    this.activeIndex = this.keyManager.activeItemIndex ?? 0;
  }
}
```

## 高對比度模式檢測

```typescript
import { HighContrastModeDetector } from '@angular/cdk/a11y';

@Component({...})
export class AppComponent {
  private highContrast = inject(HighContrastModeDetector);

  ngOnInit() {
    const mode = this.highContrast.getHighContrastMode();
    if (mode !== 'none') {
      // 用户啓用了高對比度模式（Windows 無障礙功能）
      document.body.classList.add('high-contrast-mode');
    }
  }
}
```

## 總結

Angular CDK A11y 模塊提供了構建無障礙組件所需的底層工具——焦點陷阱、屏幕閲讀器通知、焦點來源檢測、鍵盤導航管理。這些能力在自定義組件庫中尤為重要。無障礙訪問不是"錦上添花"，在越來越多的國家和地區已經是法律要求。