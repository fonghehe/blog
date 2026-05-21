---
title: "Angular 9 RC 預覽：Ivy 預設啟用與 strictTemplates 詳解"
date: 2020-01-28 10:12:20
tags:
  - Angular
readingTime: 2
description: "Angular 9 的 RC 階段已進入最後衝刺，正式版預計 2020 年 2 月釋出。相比 Angular 8 中 Ivy 只能 opt-in，Angular 9 將 Ivy 作為預設渲染引擎，同時 AOT 編譯也將成為預設模式。在 RC 期間我們提前摸清這些變化非常有價值。"
wordCount: 429
---

Angular 9 的 RC 階段已進入最後衝刺，正式版預計 2020 年 2 月釋出。相比 Angular 8 中 Ivy 只能 opt-in，Angular 9 將 Ivy 作為預設渲染引擎，同時 AOT 編譯也將成為預設模式。在 RC 期間我們提前摸清這些變化非常有價值。

## 為什麼 Ivy 是一次質的飛躍

傳統的 View Engine 生成 `.ngfactory.ts` 檔案，編譯結果與框架程式碼強耦合，tree-shaking 效果差。Ivy 的核心思路是**將渲染指令（instructions）直接內嵌到元件類裡**：

```typescript
// View Engine 編譯後（簡化）
// user.component.ngfactory.ts (額外生成的檔案)
export function View_UserComponent_0(...) { ... }
export const RenderType_UserComponent = ...;

// Ivy 編譯後（內嵌到元件）
export class UserComponent {
  static ɵcmp = defineComponent({
    type: UserComponent,
    selectors: [['app-user']],
    template: function UserComponent_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵelementStart(0, 'div');
        ɵɵtext(1);
        ɵɵelementEnd();
      }
      if (rf & 2) {
        ɵɵadvance(1);
        ɵɵtextInterpolate(ctx.name);
      }
    }
  });
}
```

結果：未使用的框架功能（如 `@Pipe`、某些 CDK 工具）不會被打包進去。

## AOT 成為開發模式預設值

之前開發模式用 JIT（快但不嚴格），生產用 AOT（慢但正確）。這導致"本地測試通過，上線才報錯"的經典問題：

```bash
# Angular 8：開發用 JIT，只在 build --prod 時用 AOT
ng serve            # JIT
ng build --prod     # AOT

# Angular 9：兩種模式都用 AOT
ng serve            # AOT（發現更多編譯期錯誤）
ng build --prod     # AOT
```

## strictTemplates 模板嚴格檢查

這是 RC 期間最值得提前瞭解的配置。開啟後，模板中的型別錯誤會在構建時報出：

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

### 常見被捕獲的錯誤

**1. @Input 型別不匹配**

```typescript
// 元件定義
@Input() count: number;

// 模板
<app-counter [count]="'hello'"></app-counter>
// strictTemplates: error TS2322: Type 'string' is not assignable to type 'number'
```

**2. 訪問不存在的屬性**

```html
{% raw %}
<!-- user 型別為 { name: string }，沒有 age -->
<p>{{ user.age }}</p>
<!-- strictTemplates: error - Property 'age' does not exist -->
{% endraw %}
```

**3. \*ngIf 後型別收窄**

```html
{% raw %}
<!-- strictTemplates 下 TypeScript 型別收窄可以正確工作 -->
<div *ngIf="user">
  {{ user.name }}
  <!-- user 在這裡被推斷為非 null -->
</div>
{% endraw %}
```

## 遷移中的注意事項

**ViewChild 需要 static 選項**

RC 中 `@ViewChild` 和 `@ContentChild` 必須顯式宣告 `static`：

```typescript
// 在 ngOnInit 中使用 → static: true
@ViewChild('myEl', { static: true }) myEl: ElementRef;

// 在 ngAfterViewInit 中使用（或條件性顯示）→ static: false
@ViewChild('myEl', { static: false }) myEl: ElementRef;
```

**第三方庫相容性**

Ivy 使用 `ngcc`（Angular Compatibility Compiler）在安裝時自動轉換未適配 Ivy 的庫。大多數情況自動處理，但如果遇到問題可手動執行：

```bash
node_modules/.bin/ngcc
```

## 總結

Angular 9 的兩大核心變化——Ivy 預設啟用 + AOT 開發模式預設——讓"本地能跑、上線報錯"成為歷史。現在 RC 階段就開始熟悉 strictTemplates 的報錯，正式釋出後升級才能少踩坑。
