---
title: "Angular 19.1：增量水合穩定化與 linkedSignal 進展"
date: 2025-01-02 16:56:33
tags:
  - Angular
readingTime: 2
description: "Angular 19.1 於 2025 年 1 月釋出，是 Angular 19 系列的第一個小版本。重點是將 Angular 19 中引入的實驗性特性向穩定化推進：增量水合（Incremental Hydration）進入開發者預覽穩定期，`linkedSignal()` 的 API 經過反饋修訂，Zoneless "
wordCount: 336
---

Angular 19.1 於 2025 年 1 月釋出，是 Angular 19 系列的第一個小版本。重點是將 Angular 19 中引入的實驗性特性向穩定化推進：增量水合（Incremental Hydration）進入開發者預覽穩定期，`linkedSignal()` 的 API 經過反饋修訂，Zoneless 模式也在持續打磨中。

## 增量水合：從實驗到開發者預覽

Angular 19.0 的增量水合標記為實驗性。Angular 19.1 基於社群反饋做了改進，並將其提升為開發者預覽（Developer Preview）：

```typescript
// 19.1 起推薦方式（與 19.0 API 相同，但穩定性更好）
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

19.1 修復的主要問題：

```html
<!-- 19.0 的已知問題：@defer 塊內巢狀時水合順序不穩定 -->
<!-- 19.1 修復：巢狀 @defer 水合順序正確化 -->
@defer (hydrate on viewport) {
<outer-component>
  @defer (hydrate on interaction) {
  <inner-component />
  <!-- 19.0 有時會先於 outer 水合，19.1 修復 -->
  }
</outer-component>
}
```

## linkedSignal：API 精簡與檔案完善

經過社群試用，Angular 團隊對 `linkedSignal()` 做了細微調整：

```typescript
// 19.0 的兩種寫法都保留（短格式和物件格式）
import { linkedSignal } from "@angular/core";

// 短格式（最常用）：源變化時重新計算
const selectedItem = linkedSignal(() => items()[0] ?? null);

// 物件格式（需要訪問前值）：
const currentPage = linkedSignal<number>({
  source: () => ({ query: searchQuery(), pageSize: pageSize() }),
  computation: (source, previous) => {
    // 查詢變化時重置到第 1 頁，否則保留當前頁
    if (!previous || previous.source.query !== source.query) return 1;
    return Math.min(previous.value, Math.ceil(totalItems() / source.pageSize));
  },
});

// 19.1 新增：linkedSignal 現在可以接受初始值引數（而不依賴 source 函式）
const count = linkedSignal({
  source: externalCount, // Signal<number>
  computation: (val) => val * 2,
});
```

## Signal Effect 清理機製改進

Angular 19.1 改進了 `effect()` 的資源清理 API：

```typescript
import { effect, inject, DestroyRef } from '@angular/core';

@Component({ standalone: true, ... })
export class DataStreamComponent {
  private ws: WebSocket | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      const url = this.wsUrl();
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onmessage = (evt) => this.messages.update(m => [...m, evt.data]);

      // 19.1 改進：onCleanup 型別更準確，支援 async 清理函式
      onCleanup(() => {
        ws.close();
        this.ws = null;
      });
    });
  }

  messages = signal<string[]>([]);
  wsUrl = input.required<string>();
}
```

## 範本型別檢查增強

Angular 19.1 增強了對 Signal 表示式的型別檢查：

```typescript
@Component({
  standalone: true,
  template: `
    <!-- 19.1 之前：編譯器不能精確檢查 Signal 巢狀訪問的型別 -->
    <!-- 19.1 之後：精確推斷 user()?.profile?.avatar 的型別 -->
    <img [src]="user()?.profile?.avatar ?? defaultAvatar" />

    <!-- @for track 表示式的型別也得到改善 -->
    @for (item of items(); track item.id) {
      {{ item.name }}
    }
  `,
})
export class UserCardComponent {
  user = input<User | null>(null);
  items = input.required<{ id: string; name: string }[]>();
  defaultAvatar = "/assets/default-avatar.png";
}
```

## 升級到 19.1

```bash
ng update @angular/core@19.1 @angular/cli@19.1

# 檢視變更日誌
npx ng-update --list
```

Angular 19.x 系列按每月節奏釋出小版本（19.1 → 19.2 → 19.3），每個版本都在為 Angular 20（預計 2025 年 5 月）積累穩定性。

## 總結

Angular 19.1 是一個"鞏固"版本——增量水合升級為開發者預覽意味著可以開始在預生產環境驗證，`linkedSignal` 的 API 也更加完善。如果你在 Angular 19.0 時因為增量水合的實驗性標籤而保持觀望，19.1 是開始評估的好時機。
