---
title: "Angular 21 RC 预览：Signal Forms 稳定、全新路由 API 与 SSR 增强"
date: 2025-10-24 10:00:00
tags:
  - Angular
  - JavaScript
readingTime: 2
description: "Angular 21 RC.0 于 2025 年 10 月初发布，正式版预计 11 月 19 日。Angular 21 是继 Angular 20 之后的下一个主版本，核心目标是将 Signal Forms 从开发者预览提升为稳定 API，并带来全新的路由 API 改进。"
---

Angular 21 RC.0 于 2025 年 10 月初发布，正式版预计 11 月 19 日。Angular 21 是继 Angular 20 之后的下一个主版本，核心目标是将 Signal Forms 从开发者预览提升为稳定 API，并带来全新的路由 API 改进。

> 本文基于 Angular 21 RC，正式版可能有细微差异。

## Signal Forms 正式稳定

Angular 21 将 Signal Forms 提升为稳定 API，意味着可以在生产环境放心使用：

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

## 全新路由 Resolve API：基于 resource()

Angular 21 将路由 Resolve（数据预加载）与 `resource()` 深度集成：

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

## 路由级 Meta 支持（原生 SEO）

Angular 21 内置了路由级元数据注入，无需 Angular Meta 服务：

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

## Angular 21 主要变化概览

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

Angular 21 提供了从 ReactiveFormsModule 迁移的 schematic：

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

## 总结

Angular 21 RC 是 Signal 化转型的收尾版本——Signal Forms 稳定意味着 Angular 的整个组件 API（输入、输出、查询、表单）都完成了 Signal 化。结合 Zoneless，Angular 的变更检测从"全局拦截"演进到"精准响应"。正式版 11 月发布，RC 阶段适合在预生产环境全面测试迁移路径。
