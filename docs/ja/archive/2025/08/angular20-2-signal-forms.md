---
title: "Angular 20.2：Signal Forms 安定化と httpResource 強化"
date: 2025-08-22 10:00:00
tags:
  - Angular
readingTime: 3
description: "Angular 20.2 が 2025 年 8 月にリリースされました。このバージョンの核心は Signal Forms の安定化推進です——20.0 と 20.1 の 2 バージョンにわたる開発者プレビュー期間を経て、Signal Forms のコア API が安定し、API サーフェスが大幅に削減されました。同時に"
---

Angular 20.2 が 2025 年 8 月にリリースされました。このバージョンの核心は Signal Forms の安定化推進です——20.0 と 20.1 の 2 バージョンにわたる開発者プレビュー期間を経て、Signal Forms のコア API が安定し、API サーフェスが大幅に削減されました。同時に、`httpResource()` がより充実したキャッシュ戦略サポートを獲得しました。

## Signal Forms の安定化進捗

Angular 20.2 では Signal Forms の API が簡略化されました。以下は最終形に近いバージョンです：

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

## Signal Forms のリアクティブな派生

Signal Forms の最大の強みは、Signal リアクティブシステムにシームレスに統合できることです：

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

## httpResource キャッシュ戦略

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

## RxJS との相互運用性の改善

Angular 20.2 では Signal Forms の RxJS 相互運用性が向上しました：

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

## まとめ

Angular 20.2 の Signal Forms はかなり成熟しており——API の安定性が高く、`resource()`、`computed()`、`effect()` との連携もスムーズです。正式安定化（Angular 21 または 21.x 予定）まであと少しの段階です。今から長期保守を計画する Angular プロジェクトであれば、20.2 から Signal Forms の開発者プレビューを使い始めるのは合理的な選択です——API に若干の変更が入る可能性があることは念頭に置いておく必要があります。
