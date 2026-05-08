---
title: "Angular 19.2 预览：Signal-based Forms 开发者预览与路由改进"
date: 2025-01-31 10:00:00
tags:
  - Angular
---

Angular 19.2 预计 2025 年 2 月发布，从已公开的 RFC 和 GitHub PR 来看，有两个值得提前了解的方向：**Signal-based Forms 进入开发者预览**，以及路由懒加载的进一步完善。本文基于当前 RC 和社区讨论，预览即将到来的变化。

> 本文基于 Angular 19.2 RC 和公开 RFC，正式版可能有差异。

## Signal-based Forms 草案

Angular 的 `ReactiveFormsModule`（FormControl、FormGroup、FormArray）是基于 RxJS Observable 构建的，与 Signal 体系格格不入。Angular 团队正在设计全新的 Signal-based Forms API：

```typescript
// 当前（ReactiveFormsModule，基于 RxJS）
import { FormControl, FormGroup, Validators } from "@angular/forms";

const form = new FormGroup({
  name: new FormControl("", [Validators.required, Validators.minLength(2)]),
  email: new FormControl("", [Validators.required, Validators.email]),
});

// 需要 subscribe 或 valueChanges Observable 来响应变化
form.valueChanges.subscribe((val) => console.log(val));
```

```typescript
// 预览（Signal-based Forms，19.2 开发者预览草案）
import { formGroup, formControl, Validators } from "@angular/forms/signal"; // 新包路径 TBD

const form = formGroup({
  name: formControl("", {
    validators: [Validators.required, Validators.minLength(2)],
  }),
  email: formControl("", {
    validators: [Validators.required, Validators.email],
  }),
});

// Signal：直接读取值（不需要 subscribe）
console.log(form.value()); // Signal<{ name: string; email: string }>
console.log(form.valid()); // Signal<boolean>
console.log(form.dirty()); // Signal<boolean>

// 在模板中绑定
// [formControl]="nameControl" 替换为新的 Signal 指令（TBD）
```

模板使用：

```html
<!-- 新 Signal Forms 模板绑定（草案，API 未最终确定）-->
<form (ngSubmit)="submit()">
  <input [signalControl]="form.controls.name" />
  <span *ngIf="form.controls.name.errors()?.['required']">姓名必填</span>

  <input type="email" [signalControl]="form.controls.email" />
  <span *ngIf="form.controls.email.errors()?.['email']">邮箱格式不正确</span>

  <button [disabled]="!form.valid()">提交</button>
</form>
```

核心优势：

```typescript
// 与 computed() 无缝集成
const submitEnabled = computed(() => form.valid() && !isSubmitting());

// 可以在 effect() 中响应表单变化
effect(() => {
  if (form.value().email) {
    preloadUserSuggestions(form.value().email);
  }
});
```

## 路由懒加载改进：defer + 路由的结合

Angular 19.2 探索将 `@defer` 与路由懒加载结合：

```typescript
// 现在：路由懒加载（模块级别）
const routes: Routes = [
  {
    path: "dashboard",
    loadComponent: () =>
      import("./dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
  },
];

// 19.2 探索：路由组件内的 @defer 块也参与路由预加载策略
// 即：进入路由时，只加载可见内容；滚动到下面时按需加载
```

## Server-Side Rendering 性能改进

Angular 19.2 改进了 SSR 的 Transfer State 机制：

```typescript
// 改进前：所有 HTTP 请求结果都序列化到 Transfer State（可能很大）
// 改进后：支持选择性 Transfer（只传输需要的数据）

@Injectable({ providedIn: "root" })
export class ApiService {
  private http = inject(HttpClient);

  getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`, {
      // 19.2 新增：标记为不需要 Transfer State
      context: new HttpContext().set(SKIP_TRANSFER_STATE, true),
    });
  }
}
```

## 开发者工具改进

Angular DevTools 在 19.2 中新增 Signal 追踪视图：

```
Angular DevTools 19.2 新增功能：
- Signal 依赖图可视化：查看哪些 Signal 影响了哪些 computed/effect
- Incremental Hydration 状态监控：看哪些 @defer 块已水合，哪些还未
- Zoneless 性能分析：对比有无 zone.js 的变更检测次数
```

## 如何升级到 19.2（发布后）

```bash
ng update @angular/core@19.2 @angular/cli@19.2

# 查看 Signal Forms API（发布后）
ng add @angular/forms@19.2
```

## 总结

Angular 19.2 最值得期待的是 Signal-based Forms——这是长期以来 Angular 表单系统最大的现代化尝试。一旦进入开发者预览，结合 Signal Inputs/Outputs/Queries，Angular 组件的整个 API 将完全脱离"装饰器 + Observable"的历史包袱。今年是 Angular 表单系统的转型之年，值得密切关注。
