---
title: "Angular 20.2：Signal Forms 穩定化與 httpResource 增強"
date: 2025-08-22 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 20.2 於 2025 年 8 月釋出。本版本的核心是推進 Signal Forms 走向穩定——經過 20.0 和 20.1 兩個版本的開發者預覽期，Signal Forms 的核心 API 趨於穩定，API surface 大幅減少。同時，`httpResource()` 獲得了更完善的快取策略支援"
wordCount: 265
---

Angular 20.2 於 2025 年 8 月釋出。本版本的核心是推進 Signal Forms 走向穩定——經過 20.0 和 20.1 兩個版本的開發者預覽期，Signal Forms 的核心 API 趨於穩定，API surface 大幅減少。同時，`httpResource()` 獲得了更完善的快取策略支援。

## Signal Forms 穩定化進展

Angular 20.2 對 Signal Forms 做了 API 簡化，以下是相對最終形態更近的版本：

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";
// 注意：20.2 將 Signal Forms API 移入主 @angular/forms 包
// （不再需要單獨的 @angular/forms/signal 子路徑）

@Component({
  standalone: true,
  imports: [ReactiveFormsModule], // Signal Forms 通過擴充套件 ReactiveFormsModule 提供
  template: `
    <form [sfGroup]="profileForm" (ngSubmit)="save()">
      <section>
        <input [sfControl]="profileForm.controls.displayName" />
        <span class="char-count">
          {{ profileForm.controls.displayName.value().length }}/50
        </span>
      </section>

      <section>
        <textarea [sfControl]="profileForm.controls.bio" rows="4"></textarea>
      </section>

      <button type="submit" [disabled]="!canSave()">儲存</button>
    </form>
  `,
})
export class ProfileEditComponent {
  profileForm = formGroup({
    displayName: formControl("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    bio: formControl("", [Validators.maxLength(200)]),
  });

  isSaving = signal(false);

  canSave = computed(
    () =>
      this.profileForm.valid() && this.profileForm.dirty() && !this.isSaving(),
  );

  async save() {
    if (!this.canSave()) return;
    this.isSaving.set(true);

    const values = this.profileForm.value();
    await this.profileService.update(values);

    this.profileForm.markAsPristine(); // 儲存後清除 dirty 狀態
    this.isSaving.set(false);
  }
}
```

## Signal Forms 的響應式派生

Signal Forms 最大的優勢是可以無縫融入 Signal 響應式體系：

```typescript
@Component({ standalone: true, ... })
export class SearchFormComponent {
  searchForm = formGroup({
    keyword: formControl(''),
    category: formControl<'all' | 'docs' | 'code'>('all'),
    dateRange: formGroup({
      from: formControl<Date | null>(null),
      to: formControl<Date | null>(null),
    }),
  });

  // 即時搜尋：關鍵詞防抖
  debouncedKeyword = toSignal(
    toObservable(this.searchForm.controls.keyword.value).pipe(
      debounceTime(300),
      distinctUntilChanged()
    ),
    { initialValue: '' }
  );

  // 搜尋結果：響應所有條件變化
  searchResults = resource({
    request: computed(() => ({
      q: this.debouncedKeyword(),
      cat: this.searchForm.controls.category.value(),
      from: this.searchForm.controls.dateRange.controls.from.value(),
      to: this.searchForm.controls.dateRange.controls.to.value(),
    })),
    loader: ({ request }) => this.searchService.search(request),
  });
}
```

## httpResource 快取策略

```typescript
import { httpResource, CacheStrategy } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class NewsListComponent {
  category = signal('tech');

  // SWR（stale-while-revalidate）快取策略
  newsResource = httpResource<NewsItem[]>(() => `/api/news?cat=${this.category()}`, {
    cache: {
      strategy: CacheStrategy.StaleWhileRevalidate,
      maxAge: 5 * 60 * 1000,  // 5 分鐘內使用快取，後臺靜默重新整理
    }
  });

  // 強制重新整理（忽略快取）
  hardRefresh() {
    this.newsResource.reload({ force: true });
  }
}
```

## 與 RxJS 的互操作改進

Angular 20.2 為 Signal Forms 提供了更好的 RxJS 互操作：

```typescript
import { toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class FilterComponent {
  filterForm = formGroup({
    status: formControl<'all' | 'active' | 'archived'>('all'),
    sortBy: formControl<'date' | 'name'>('date'),
  });

  // 將 Signal Form 的值流轉為 Observable（用於需要 RxJS 管道處理的場景）
  formValue$ = toObservable(this.filterForm.value);

  // 只有當兩個欄位都有效且變化時才觸發
  filteredChanges$ = this.formValue$.pipe(
    filter(() => this.filterForm.valid()),
    debounceTime(100),
    distinctUntilChanged(isEqual)  // lodash isEqual 深比較
  );
}
```

## 總結

Angular 20.2 的 Signal Forms 已經相當成熟——API 穩定性高，與 resource()、computed()、effect() 的配合流暢。距離正式穩定（預計 Angular 21 或 21.x）只剩最後一段路。如果你現在開始的 Angular 專案計劃長期維護，從 20.2 起使用 Signal Forms 開發者預覽是合理的選擇，只需做好 API 可能有小變化的心理準備。
