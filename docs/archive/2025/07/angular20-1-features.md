---
title: "Angular 20.1：resource() API 完善与 Signal Forms 进展"
date: 2025-07-02 10:00:00
tags:
  - Angular
  - JavaScript
readingTime: 2
description: "Angular 20.1 于 2025 年 6 月底发布，延续 Angular 20 的特性路线。本版本的重点是完善 `resource()` API（从实验性升级为开发者预览），并推进 Signal Forms 的稳定化进程。"
wordCount: 236
---

Angular 20.1 于 2025 年 6 月底发布，延续 Angular 20 的特性路线。本版本的重点是完善 `resource()` API（从实验性升级为开发者预览），并推进 Signal Forms 的稳定化进程。

## resource() API 升级为开发者预览

Angular 20 引入的 `resource()` 在 20.1 中经过 API 调整后进入开发者预览：

```typescript
import { resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({ standalone: true, ... })
export class UserListComponent {
  private http = inject(HttpClient);

  searchQuery = signal('');
  currentPage = signal(1);

  // httpResource：专为 HttpClient 优化的 resource 变体（20.1 新增）
  usersResource = httpResource<User[]>(() =>
    `/api/users?q=${this.searchQuery()}&page=${this.currentPage()}`
  );

  // 或者通用 resource（支持任意异步逻辑）
  statsResource = resource({
    request: this.currentPage,
    loader: async ({ request: page, abortSignal }) => {
      // 20.1 新增：支持 AbortSignal，切换请求时自动取消上一个
      const res = await fetch(`/api/stats?page=${page}`, { signal: abortSignal });
      return res.json() as Promise<Stats>;
    }
  });
}
```

### httpResource：专为 Angular HTTP 优化

```typescript
import { httpResource } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class ProductDetailComponent {
  productId = input.required<string>();

  // httpResource 会自动：
  // 1. 处理 Angular 的 HTTP 拦截器链
  // 2. 在 SSR 中写入/读取 Transfer State
  // 3. 支持 withCredentials、headers 等配置
  product = httpResource<Product>(() => ({
    url: `/api/products/${this.productId()}`,
    headers: { 'Accept-Language': 'zh-CN' }
  }));
}
```

## Signal Forms：验证器增强

Angular 20.1 为 Signal Forms 新增了异步验证器支持：

```typescript
import { formControl, Validators, asyncValidator } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// 异步验证器：用户名唯一性检查
const usernameUniqueValidator = asyncValidator(async (value: string) => {
  if (!value) return null;
  const exists = await checkUsernameExists(value);
  return exists ? { taken: { value } } : null;
});

@Component({ standalone: true, ... })
export class RegisterComponent {
  form = formGroup({
    username: formControl('', {
      validators: [Validators.required, Validators.minLength(3)],
      asyncValidators: [usernameUniqueValidator]
    }),
    email: formControl('', [Validators.required, Validators.email]),
  });

  // 新增：pending() Signal - 是否有异步验证在进行中
  isValidating = computed(() =>
    Object.values(this.form.controls).some(c => c.pending())
  );
}
```

模板中：

```html
<input [sfControl]="form.controls.username" />
@if (form.controls.username.pending()()) {
<small>检查用户名可用性...</small>
} @if (form.controls.username.hasError('taken')()) {
<small>该用户名已被占用</small>
}
```

## 增量水合：hydrate on timer

Angular 20.1 新增了 `hydrate on timer` 触发条件：

```html
<!-- 页面加载后 3 秒再水合（适合低优先级广告/推荐内容）-->
@defer (hydrate on timer(3000)) {
<recommendation-sidebar />
}

<!-- 组合条件：进入视口 AND 空闲时才水合 -->
@defer (hydrate on viewport; hydrate when isLoggedIn()) {
<user-personalized-feed />
}
```

## DevTools 更新

Angular DevTools 20.1 新增 resource 追踪：

```
新增面板：Resources
- 显示当前激活的所有 resource() 实例
- 状态：loading / success / error
- 上次加载时间
- 请求参数快照
- 手动触发 reload 按钮
```

## 总结

Angular 20.1 的核心进展是 `resource()` 生态的完善——`httpResource()` 让 Angular HTTP 与新的声明式数据流模式无缝结合，异步验证器让 Signal Forms 具备了生产所需的完整功能。按照 Angular 的发布节奏，20.2（8 月）和 21（11 月）会继续完善这个体系。
