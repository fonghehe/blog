---
title: "Angular 20.1：resource() API 完善與 Signal Forms 進展"
date: 2025-07-02 13:56:33
tags:
  - Angular
  - JavaScript
readingTime: 2
description: "Angular 20.1 於 2025 年 6 月底發佈，延續 Angular 20 的特性路線。本版本的重點是完善 `resource()` API（從實驗性升級為開發者預覽），並推進 Signal Forms 的穩定化進程。"
wordCount: 236
---

Angular 20.1 於 2025 年 6 月底發佈，延續 Angular 20 的特性路線。本版本的重點是完善 `resource()` API（從實驗性升級為開發者預覽），並推進 Signal Forms 的穩定化進程。

## resource() API 升級為開發者預覽

Angular 20 引入的 `resource()` 在 20.1 中經過 API 調整後進入開發者預覽：

```typescript
import { resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({ standalone: true, ... })
export class UserListComponent {
  private http = inject(HttpClient);

  searchQuery = signal('');
  currentPage = signal(1);

  // httpResource：專為 HttpClient 優化的 resource 變體（20.1 新增）
  usersResource = httpResource<User[]>(() =>
    `/api/users?q=${this.searchQuery()}&page=${this.currentPage()}`
  );

  // 或者通用 resource（支持任意異步邏輯）
  statsResource = resource({
    request: this.currentPage,
    loader: async ({ request: page, abortSignal }) => {
      // 20.1 新增：支持 AbortSignal，切換請求時自動取消上一個
      const res = await fetch(`/api/stats?page=${page}`, { signal: abortSignal });
      return res.json() as Promise<Stats>;
    }
  });
}
```

### httpResource：專為 Angular HTTP 優化

```typescript
import { httpResource } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class ProductDetailComponent {
  productId = input.required<string>();

  // httpResource 會自動：
  // 1. 處理 Angular 的 HTTP 攔截器鏈
  // 2. 在 SSR 中寫入/讀取 Transfer State
  // 3. 支持 withCredentials、headers 等配置
  product = httpResource<Product>(() => ({
    url: `/api/products/${this.productId()}`,
    headers: { 'Accept-Language': 'zh-CN' }
  }));
}
```

## Signal Forms：驗證器增強

Angular 20.1 為 Signal Forms 新增了異步驗證器支持：

```typescript
import { formControl, Validators, asyncValidator } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// 異步驗證器：用户名唯一性檢查
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

  // 新增：pending() Signal - 是否有異步驗證在進行中
  isValidating = computed(() =>
    Object.values(this.form.controls).some(c => c.pending())
  );
}
```

模板中：

```html
<input [sfControl]="form.controls.username" />
@if (form.controls.username.pending()()) {
<small>檢查用户名可用性...</small>
} @if (form.controls.username.hasError('taken')()) {
<small>該用户名已被佔用</small>
}
```

## 增量水合：hydrate on timer

Angular 20.1 新增了 `hydrate on timer` 觸發條件：

```html
<!-- 頁面加載後 3 秒再水合（適合低優先級廣告/推薦內容）-->
@defer (hydrate on timer(3000)) {
<recommendation-sidebar />
}

<!-- 組合條件：進入視口 AND 空閒時才水合 -->
@defer (hydrate on viewport; hydrate when isLoggedIn()) {
<user-personalized-feed />
}
```

## DevTools 更新

Angular DevTools 20.1 新增 resource 追蹤：

```
新增面板：Resources
- 顯示當前激活的所有 resource() 實例
- 狀態：loading / success / error
- 上次加載時間
- 請求參數快照
- 手動觸發 reload 按鈕
```

## 總結

Angular 20.1 的核心進展是 `resource()` 生態的完善——`httpResource()` 讓 Angular HTTP 與新的聲明式數據流模式無縫結合，異步驗證器讓 Signal Forms 具備了生產所需的完整功能。按照 Angular 的發佈節奏，20.2（8 月）和 21（11 月）會繼續完善這個體系。
