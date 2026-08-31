---
title: "Angular 21 RC プレビュー：Signal Forms 安定化、新ルーターAPI と SSR 強化"
date: 2025-10-24 14:18:55
tags:
  - Angular
  - JavaScript
readingTime: 3
description: "Angular 21 RC.0 は 2025 年 10 月上旬にリリースされ、正式版は 11 月 19 日の予定。Angular 21 は Angular 20 の次のメジャーバージョンで、核心目標は Signal Forms を開発者プレビューから安定 API に引き上げ、ルーティング API の改善をもたらすことだ。"
wordCount: 430
---

Angular 21 RC.0 は 2025 年 10 月上旬にリリースされ、正式版は 11 月 19 日の予定。Angular 21 は Angular 20 の次のメジャーバージョンで、核心目標は Signal Forms を開発者プレビューから安定 API に引き上げ、ルーティング API の改善をもたらすことだ。

> 本記事は Angular 21 RC に基づいており、正式版とは細かな差異がある可能性がある。

## Signal Forms 正式稳定

Angular 21 が Signal Forms を安定 API に引き上げたことで、本番環境でも安心して使えるようになった：

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";
// Angular 21：Signal Forms API 正式稳定，不再标记 @developer-preview

@Component({
  standalone: true,
  imports: [SignalFormsModule],
  template: `
    <form [sfGroup]="form" (ngSubmit)="submit()">
      <input [sfControl]="form.controls.name" placeholder="姓名" />
      <input
        [sfControl]="form.controls.email"
        type="email"
        placeholder="邮箱"
      />
      <button [disabled]="form.invalid()">提交</button>
    </form>

    <!-- 实时统计（展示 Signal Forms 的响应式优势）-->
    <p>表单完成度：{{ completionRate() }}%</p>
  `,
})
export class ContactFormComponent {
  form = formGroup({
    name: formControl("", [Validators.required]),
    email: formControl("", [Validators.required, Validators.email]),
    phone: formControl(""),
    company: formControl(""),
  });

  // 基于 Signal Forms 的派生计算
  completionRate = computed(() => {
    const controls = Object.values(this.form.controls);
    const filled = controls.filter((c) => c.value() !== "").length;
    return Math.round((filled / controls.length) * 100);
  });
}
```

## 新しいルーティング Resolve API：resource() ベース

Angular 21 はルーティングの Resolve（データの事前読み込み）を `resource()` と深く統合した：

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

// 组件中访问
@Component({ standalone: true, ... })
export class UserDetailComponent {
  private routeData = inject(ActivatedRoute).data;

  // 直接获取 resource，可以访问 loading/error/value 状态
  userResource = toSignal(this.routeData.pipe(map(d => d['user'])));
}
```

## ルート単位の Meta 対応（ネイティブ SEO）

Angular 21 はルート単位のメタデータ注入を内蔵し、Angular Meta サービスは不要になった：

```typescript
export const routes: Routes = [
  {
    path: "about",
    component: AboutComponent,
    data: {
      meta: {
        title: "关于我们 - My App",
        description: "了解我们的团队和使命",
        og: {
          title: "关于我们",
          image: "/assets/og-about.jpg",
        },
      },
    },
  },
];
```

```typescript
// app.component.ts：自动注入路由 meta
@Component({
  standalone: true,
  imports: [RouterOutlet, RouterMeta], // 新指令
  template: `
    <router-meta />
    <!-- 自动根据当前路由 data.meta 更新 <head> -->
    <router-outlet />
  `,
})
export class AppComponent {}
```

## Angular 21 の主要な変更点

```
特性                          Angular 20      Angular 21
────────────────────────────────────────────────────────────
Signal Forms                 开发者预览      正式稳定 ✅
resource() / httpResource()  开发者预览      正式稳定 ✅
Zoneless                     正式稳定        继续优化性能
linkedSignal                 开发者预览      正式稳定 ✅
路由 resource resolve        无              开发者预览
路由级 Meta                  无              开发者预览
zone.js 废弃警告             否              新项目警告 ⚠️
```

## Signal Forms 迁移路线

Angular 21 は ReactiveFormsModule からの移行 schematic を提供している：

```bash
# 自动迁移（Angular 21 RC）
ng generate @angular/forms:signal-forms-migration

# 该 schematic 会：
# 1. 将 FormControl → formControl()
# 2. 将 FormGroup → formGroup()
# 3. 将 this.form.get('x').value → this.form.controls.x.value()
# 4. 将 this.form.valueChanges → toObservable(this.form.value)
```

注意：自动迁移只处理简单情况，复杂的自定义 validator、动态 FormArray 需要手动迁移。

## 升级到 Angular 21 RC

```bash
ng update @angular/core@21-rc @angular/cli@21-rc

# 注意：Angular 21 会对仍在使用 zone.js 的新项目显示弃用警告
# 不影响运行，但会在构建时打印提示
```

## まとめ

Angular 21 RC 是 Signal 化转型的收尾版本——Signal Forms 稳定意味着 Angular 的整个组件 API（输入、输出、查询、表单）都完成了 Signal 化。结合 Zoneless，Angular 的变更检测从"全局拦截"演进到"精准响应"。正式版 11 月发布，RC 阶段适合在预生产环境全面测试迁移路径。
