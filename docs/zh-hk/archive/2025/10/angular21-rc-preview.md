---
title: "Angular 21 RC 預覽：Signal Forms 穩定、全新路由 API 與 SSR 增強"
date: 2025-10-24 14:18:55
tags:
  - Angular
  - JavaScript
readingTime: 2
description: "Angular 21 RC.0 於 2025 年 10 月初發布，正式版預計 11 月 19 日。Angular 21 是繼 Angular 20 之後的下一個主版本，核心目標是將 Signal Forms 從開發者預覽提升為穩定 API，並帶來全新的路由 API 改進。"
wordCount: 329
---

Angular 21 RC.0 於 2025 年 10 月初發布，正式版預計 11 月 19 日。Angular 21 是繼 Angular 20 之後的下一個主版本，核心目標是將 Signal Forms 從開發者預覽提升為穩定 API，並帶來全新的路由 API 改進。

> 本文基於 Angular 21 RC，正式版可能有細微差異。

## Signal Forms 正式穩定

Angular 21 將 Signal Forms 提升為穩定 API，意味着可以在生產環境放心使用：

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";
// Angular 21：Signal Forms API 正式穩定，不再標記 @developer-preview

@Component({
  standalone: true,
  imports: [SignalFormsModule],
  template: `
    <form [sfGroup]="form" (ngSubmit)="submit()">
      <input [sfControl]="form.controls.name" placeholder="姓名" />
      <input
        [sfControl]="form.controls.email"
        type="email"
        placeholder="郵箱"
      />
      <button [disabled]="form.invalid()">提交</button>
    </form>

    <!-- 實時統計（展示 Signal Forms 的響應式優勢）-->
    <p>表單完成度：{{ completionRate() }}%</p>
  `,
})
export class ContactFormComponent {
  form = formGroup({
    name: formControl("", [Validators.required]),
    email: formControl("", [Validators.required, Validators.email]),
    phone: formControl(""),
    company: formControl(""),
  });

  // 基於 Signal Forms 的派生計算
  completionRate = computed(() => {
    const controls = Object.values(this.form.controls);
    const filled = controls.filter((c) => c.value() !== "").length;
    return Math.round((filled / controls.length) * 100);
  });
}
```

## 全新路由 Resolve API：基於 resource()

Angular 21 將路由 Resolve（數據預加載）與 `resource()` 深度集成：

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserDetailComponent,
    // 新的 resource resolve：返回 resource 而非 Observable/Promise
    resolve: {
      user: (route) => httpResource<User>(`/api/users/${route.params['id']}`),
    }
  }
];

// 組件中訪問
@Component({ standalone: true, ... })
export class UserDetailComponent {
  private routeData = inject(ActivatedRoute).data;

  // 直接獲取 resource，可以訪問 loading/error/value 狀態
  userResource = toSignal(this.routeData.pipe(map(d => d['user'])));
}
```

## 路由級 Meta 支援（原生 SEO）

Angular 21 內置了路由級元數據注入，無需 Angular Meta 服務：

```typescript
export const routes: Routes = [
  {
    path: "about",
    component: AboutComponent,
    data: {
      meta: {
        title: "關於我們 - My App",
        description: "瞭解我們的團隊和使命",
        og: {
          title: "關於我們",
          image: "/assets/og-about.jpg",
        },
      },
    },
  },
];
```

```typescript
// app.component.ts：自動注入路由 meta
@Component({
  standalone: true,
  imports: [RouterOutlet, RouterMeta], // 新指令
  template: `
    <router-meta />
    <!-- 自動根據當前路由 data.meta 更新 <head> -->
    <router-outlet />
  `,
})
export class AppComponent {}
```

## Angular 21 主要變化概覽

```
特性                          Angular 20      Angular 21
────────────────────────────────────────────────────────────
Signal Forms                 開發者預覽      正式穩定 ✅
resource() / httpResource()  開發者預覽      正式穩定 ✅
Zoneless                     正式穩定        繼續優化性能
linkedSignal                 開發者預覽      正式穩定 ✅
路由 resource resolve        無              開發者預覽
路由級 Meta                  無              開發者預覽
zone.js 廢棄警告             否              新項目警告 ⚠️
```

## Signal Forms 遷移路線

Angular 21 提供了從 ReactiveFormsModule 遷移的 schematic：

```bash
# 自動遷移（Angular 21 RC）
ng generate @angular/forms:signal-forms-migration

# 該 schematic 會：
# 1. 將 FormControl → formControl()
# 2. 將 FormGroup → formGroup()
# 3. 將 this.form.get('x').value → this.form.controls.x.value()
# 4. 將 this.form.valueChanges → toObservable(this.form.value)
```

注意：自動遷移隻處理簡單情況，複雜的自定義 validator、動態 FormArray 需要手動遷移。

## 升級到 Angular 21 RC

```bash
ng update @angular/core@21-rc @angular/cli@21-rc

# 注意：Angular 21 會對仍在使用 zone.js 的新項目顯示棄用警告
# 不影響運行，但會在構建時打印提示
```

## 總結

Angular 21 RC 是 Signal 化轉型的收尾版本——Signal Forms 穩定意味着 Angular 的整個組件 API（輸入、輸出、查詢、表單）都完成了 Signal 化。結合 Zoneless，Angular 的變更檢測從"全局攔截"演進到"精準響應"。正式版 11 月發佈，RC 階段適合在預生產環境全面測試遷移路徑。
