---
title: "Angular 20.2：Signal Forms 稳定化与 httpResource 增强"
date: 2025-08-22 10:00:00
tags:
  - Angular
---

Angular 20.2 于 2025 年 8 月发布。本版本的核心是推进 Signal Forms 走向稳定——经过 20.0 和 20.1 两个版本的开发者预览期，Signal Forms 的核心 API 趋于稳定，API surface 大幅减少。同时，`httpResource()` 获得了更完善的缓存策略支持。

## Signal Forms 稳定化进展

Angular 20.2 对 Signal Forms 做了 API 简化，以下是相对最终形态更近的版本：

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";
// 注意：20.2 将 Signal Forms API 移入主 @angular/forms 包
// （不再需要单独的 @angular/forms/signal 子路径）

@Component({
  standalone: true,
  imports: [ReactiveFormsModule], // Signal Forms 通过扩展 ReactiveFormsModule 提供
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

      <button type="submit" [disabled]="!canSave()">保存</button>
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

    this.profileForm.markAsPristine(); // 保存后清除 dirty 状态
    this.isSaving.set(false);
  }
}
```

## Signal Forms 的响应式派生

Signal Forms 最大的优势是可以无缝融入 Signal 响应式体系：

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

  // 实时搜索：关键词防抖
  debouncedKeyword = toSignal(
    toObservable(this.searchForm.controls.keyword.value).pipe(
      debounceTime(300),
      distinctUntilChanged()
    ),
    { initialValue: '' }
  );

  // 搜索结果：响应所有条件变化
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

## httpResource 缓存策略

```typescript
import { httpResource, CacheStrategy } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class NewsListComponent {
  category = signal('tech');

  // SWR（stale-while-revalidate）缓存策略
  newsResource = httpResource<NewsItem[]>(() => `/api/news?cat=${this.category()}`, {
    cache: {
      strategy: CacheStrategy.StaleWhileRevalidate,
      maxAge: 5 * 60 * 1000,  // 5 分钟内使用缓存，后台静默刷新
    }
  });

  // 强制刷新（忽略缓存）
  hardRefresh() {
    this.newsResource.reload({ force: true });
  }
}
```

## 与 RxJS 的互操作改进

Angular 20.2 为 Signal Forms 提供了更好的 RxJS 互操作：

```typescript
import { toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class FilterComponent {
  filterForm = formGroup({
    status: formControl<'all' | 'active' | 'archived'>('all'),
    sortBy: formControl<'date' | 'name'>('date'),
  });

  // 将 Signal Form 的值流转为 Observable（用于需要 RxJS 管道处理的场景）
  formValue$ = toObservable(this.filterForm.value);

  // 只有当两个字段都有效且变化时才触发
  filteredChanges$ = this.formValue$.pipe(
    filter(() => this.filterForm.valid()),
    debounceTime(100),
    distinctUntilChanged(isEqual)  // lodash isEqual 深比较
  );
}
```

## 总结

Angular 20.2 的 Signal Forms 已经相当成熟——API 稳定性高，与 resource()、computed()、effect() 的配合流畅。距离正式稳定（预计 Angular 21 或 21.x）只剩最后一段路。如果你现在开始的 Angular 项目计划长期维护，从 20.2 起使用 Signal Forms 开发者预览是合理的选择，只需做好 API 可能有小变化的心理准备。
