---
title: "Angular 19.2 預覽：Signal-based Forms 開發者預覽與路由改進"
date: 2025-01-31 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 19.2 預計 2025 年 2 月釋出，從已公開的 RFC 和 GitHub PR 來看，有兩個值得提前瞭解的方向：**Signal-based Forms 進入開發者預覽**，以及路由懶載入的進一步完善。本文基於當前 RC 和社群討論，預覽即將到來的變化。"
wordCount: 309
---

Angular 19.2 預計 2025 年 2 月釋出，從已公開的 RFC 和 GitHub PR 來看，有兩個值得提前瞭解的方向：**Signal-based Forms 進入開發者預覽**，以及路由懶載入的進一步完善。本文基於當前 RC 和社群討論，預覽即將到來的變化。

> 本文基於 Angular 19.2 RC 和公開 RFC，正式版可能有差異。

## Signal-based Forms 草案

Angular 的 `ReactiveFormsModule`（FormControl、FormGroup、FormArray）是基於 RxJS Observable 構建的，與 Signal 體系格格不入。Angular 團隊正在設計全新的 Signal-based Forms API：

```typescript
// 當前（ReactiveFormsModule，基於 RxJS）
import { FormControl, FormGroup, Validators } from "@angular/forms";

const form = new FormGroup({
  name: new FormControl("", [Validators.required, Validators.minLength(2)]),
  email: new FormControl("", [Validators.required, Validators.email]),
});

// 需要 subscribe 或 valueChanges Observable 來響應變化
form.valueChanges.subscribe((val) => console.log(val));
```

```typescript
// 預覽（Signal-based Forms，19.2 開發者預覽草案）
import { formGroup, formControl, Validators } from "@angular/forms/signal"; // 新包路徑 TBD

const form = formGroup({
  name: formControl("", {
    validators: [Validators.required, Validators.minLength(2)],
  }),
  email: formControl("", {
    validators: [Validators.required, Validators.email],
  }),
});

// Signal：直接讀取值（不需要 subscribe）
console.log(form.value()); // Signal<{ name: string; email: string }>
console.log(form.valid()); // Signal<boolean>
console.log(form.dirty()); // Signal<boolean>

// 在模板中繫結
// [formControl]="nameControl" 替換為新的 Signal 指令（TBD）
```

模板使用：

```html
<!-- 新 Signal Forms 模板繫結（草案，API 未最終確定）-->
<form (ngSubmit)="submit()">
  <input [signalControl]="form.controls.name" />
  <span *ngIf="form.controls.name.errors()?.['required']">姓名必填</span>

  <input type="email" [signalControl]="form.controls.email" />
  <span *ngIf="form.controls.email.errors()?.['email']">郵箱格式不正確</span>

  <button [disabled]="!form.valid()">提交</button>
</form>
```

核心優勢：

```typescript
// 與 computed() 無縫整合
const submitEnabled = computed(() => form.valid() && !isSubmitting());

// 可以在 effect() 中響應表單變化
effect(() => {
  if (form.value().email) {
    preloadUserSuggestions(form.value().email);
  }
});
```

## 路由懶載入改進：defer + 路由的結合

Angular 19.2 探索將 `@defer` 與路由懶載入結合：

```typescript
// 現在：路由懶載入（模組級別）
const routes: Routes = [
  {
    path: "dashboard",
    loadComponent: () =>
      import("./dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
  },
];

// 19.2 探索：路由元件內的 @defer 塊也參與路由預載入策略
// 即：進入路由時，只加載可見內容；滾動到下面時按需載入
```

## Server-Side Rendering 效能改進

Angular 19.2 改進了 SSR 的 Transfer State 機制：

```typescript
// 改進前：所有 HTTP 請求結果都序列化到 Transfer State（可能很大）
// 改進後：支援選擇性 Transfer（只傳輸需要的資料）

@Injectable({ providedIn: "root" })
export class ApiService {
  private http = inject(HttpClient);

  getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`, {
      // 19.2 新增：標記為不需要 Transfer State
      context: new HttpContext().set(SKIP_TRANSFER_STATE, true),
    });
  }
}
```

## 開發者工具改進

Angular DevTools 在 19.2 中新增 Signal 追蹤檢視：

```
Angular DevTools 19.2 新增功能：
- Signal 依賴圖視覺化：檢視哪些 Signal 影響了哪些 computed/effect
- Incremental Hydration 狀態監控：看哪些 @defer 塊已水合，哪些還未
- Zoneless 效能分析：對比有無 zone.js 的變更檢測次數
```

## 如何升級到 19.2（釋出後）

```bash
ng update @angular/core@19.2 @angular/cli@19.2

# 檢視 Signal Forms API（釋出後）
ng add @angular/forms@19.2
```

## 總結

Angular 19.2 最值得期待的是 Signal-based Forms——這是長期以來 Angular 表單系統最大的現代化嘗試。一旦進入開發者預覽，結合 Signal Inputs/Outputs/Queries，Angular 元件的整個 API 將完全脫離"裝飾器 + Observable"的歷史包袱。今年是 Angular 表單系統的轉型之年，值得密切關注。
