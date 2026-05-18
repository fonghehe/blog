---
title: "Angular 21.1 正式發佈：httpResource 穩定化與 Signal 生態全面落地"
date: 2026-01-03 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 21 在 2025 年 11 月完成了 Signal 化轉型的里程碑，而 21.1 作為第一個小版本，在 2026 年 1 月帶來了大量生態穩定化工作。其中最引人注目的是 `httpResource` 正式升級為穩定 API，以及 `linkedSignal` 在複雜狀態管理中的深度集成。"
---

Angular 21 在 2025 年 11 月完成了 Signal 化轉型的里程碑，而 21.1 作為第一個小版本，在 2026 年 1 月帶來了大量生態穩定化工作。其中最引人注目的是 `httpResource` 正式升級為穩定 API，以及 `linkedSignal` 在複雜狀態管理中的深度集成。

## httpResource 全面穩定

`httpResource` 在 Angular 20 中以開發者預覽身份亮相，經過兩個大版本的打磨，21.1 將其標記為穩定。它將 HTTP 請求與 Signal 反應式系統無縫融合：

```typescript
import { httpResource } from "@angular/common/http";
import { computed, signal } from "@angular/core";

@Component({
  selector: "app-user-profile",
  template: `
    @if (userResource.isLoading()) {
      <app-skeleton />
    } @else if (userResource.error()) {
      <p class="error">{{ userResource.error()?.message }}</p>
    } @else {
      <app-user-card [user]="userResource.value()!" />
    }
  `,
})
export class UserProfileComponent {
  userId = signal<number>(1);

  userResource = httpResource<User>(() => ({
    url: `/api/users/${this.userId()}`,
    method: "GET",
  }));

  // 依賴 userId Signal，自動重新請求
  displayName = computed(() => userResource.value()?.name ?? "加載中...");
}
```

21.1 新增了請求去重（request deduplication）與緩存策略配置：

```typescript
userResource = httpResource<User>(() => `/api/users/${this.userId()}`, {
  // 相同 URL 的併發請求自動合併
  deduplicate: true,
  // 緩存 30 秒
  cache: { ttl: 30_000 },
  // 請求失敗時自動重試 2 次
  retry: { count: 2, delay: 1000 },
});
```

## linkedSignal 的複雜場景應用

`linkedSignal` 解決了一類經典問題：當源 Signal 改變時，派生 Signal 需要重置但又保留用户的本地修改。

```typescript
@Component({ template: `...` })
export class PaginatedListComponent {
  pageSize = signal(10);
  currentPage = signal(1);

  // 當 pageSize 變化時，自動重置到第一頁
  // 但用户手動翻頁時保持 currentPage 不受 pageSize 影響
  page = linkedSignal({
    source: this.pageSize,
    computation: () => 1, // pageSize 變化時重置為 1
  });

  items = httpResource(() => ({
    url: "/api/items",
    params: { page: this.page(), size: this.pageSize() },
  }));

  goToPage(n: number) {
    this.page.set(n); // 用户操作，不觸發重置
  }

  changePageSize(size: number) {
    this.pageSize.set(size); // 觸發 page 重置為 1
  }
}
```

## Signal DevTools 增強

Angular DevTools 在 21.1 中針對 Signal 調試做了重大升級：

- **Signal 依賴圖可視化**：在 DevTools 面板中可以直觀看到每個 Signal 的依賴關係
- **時間旅行調試**：記錄 Signal 狀態變化歷史，支持回退到任意快照
- **性能熱點檢測**：標記出頻繁觸發的 computed 和 effect，幫助識別過度計算

```typescript
// 開發模式下，這段代碼會在 DevTools 中顯示完整調用棧
const total = computed(
  () => {
    // DevTools 會追蹤此 computed 的所有依賴
    return items().reduce((sum, item) => sum + item.price, 0);
  },
  { debugName: "cartTotal" },
); // 21.1 新增 debugName 選項
```

## 遷移指南：從 21.0 升級到 21.1

```bash
ng update @angular/core@21.1 @angular/cli@21.1
```

21.1 完全向後兼容，主要變化：

1. `httpClient.get()` 等傳統方法仍然可用，但 IDE 會顯示"建議遷移到 httpResource"提示
2. `resource()` API 的 `loader` 函數現在支持 `AbortSignal`，取消請求更加優雅
3. `effect()` 的調度策略新增 `microtask` 選項，適用於需要同步感知的場景

## 總結

Angular 21.1 穩定化了 `httpResource` 與 Signal 工具鏈，讓 2025 年許多"開發者預覽"功能真正進入生產可用狀態。配合增強的 DevTools，2026 年的 Angular 開發體驗比以往任何時候都更加流暢。下一個版本 21.2 將聚焦於 Signal Forms 的生產實踐改進，值得期待。
