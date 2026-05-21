---
title: "Angular 20.2: Signal Forms Stabilization and httpResource Enhancements"
date: 2025-08-22 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 20.2 was released in August 2025. The core focus of this release is advancing Signal Forms toward stability — after developer preview periods in version"
wordCount: 181
---

Angular 20.2 was released in August 2025. The core focus of this release is advancing Signal Forms toward stability — after developer preview periods in versions 20.0 and 20.1, the core Signal Forms APIs have stabilized with a significantly reduced API surface. At the same time, `httpResource()` gained more comprehensive cache strategy support.

## Signal Forms Stabilization Progress

Angular 20.2 simplified the Signal Forms API. The following is a version closer to the final form:

```typescript
import { formGroup, formControl, Validators } from "@angular/forms";
// Note: 20.2 moves Signal Forms API into the main @angular/forms package
// (no longer requires a separate @angular/forms/signal sub-path)

@Component({
  standalone: true,
  imports: [ReactiveFormsModule], // Signal Forms is provided by extending ReactiveFormsModule
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

      <button type="submit" [disabled]="!canSave()">Save</button>
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

    this.profileForm.markAsPristine(); // clear dirty state after save
    this.isSaving.set(false);
  }
}
```

## Reactive Derivations in Signal Forms

The greatest advantage of Signal Forms is seamless integration into the Signal reactive system:

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

  // Real-time search: debounce keyword input
  debouncedKeyword = toSignal(
    toObservable(this.searchForm.controls.keyword.value).pipe(
      debounceTime(300),
      distinctUntilChanged()
    ),
    { initialValue: '' }
  );

  // Search results: respond to all condition changes
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

## httpResource Cache Strategies

```typescript
import { httpResource, CacheStrategy } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class NewsListComponent {
  category = signal('tech');

  // SWR (stale-while-revalidate) cache strategy
  newsResource = httpResource<NewsItem[]>(() => `/api/news?cat=${this.category()}`, {
    cache: {
      strategy: CacheStrategy.StaleWhileRevalidate,
      maxAge: 5 * 60 * 1000,  // use cache within 5 minutes, silently refresh in background
    }
  });

  // Force refresh (ignore cache)
  hardRefresh() {
    this.newsResource.reload({ force: true });
  }
}
```

## Improved RxJS Interoperability

Angular 20.2 provides better RxJS interoperability for Signal Forms:

```typescript
import { toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class FilterComponent {
  filterForm = formGroup({
    status: formControl<'all' | 'active' | 'archived'>('all'),
    sortBy: formControl<'date' | 'name'>('date'),
  });

  // Convert Signal Form value stream to Observable (for scenarios requiring RxJS pipelines)
  formValue$ = toObservable(this.filterForm.value);

  // Only trigger when both fields are valid and have changed
  filteredChanges$ = this.formValue$.pipe(
    filter(() => this.filterForm.valid()),
    debounceTime(100),
    distinctUntilChanged(isEqual)  // lodash isEqual deep comparison
  );
}
```

## Summary

Angular 20.2's Signal Forms is quite mature — the API is highly stable and integrates smoothly with `resource()`, `computed()`, and `effect()`. It's only a short distance from official stability (expected in Angular 21 or 21.x). If you're starting an Angular project now that you plan to maintain long-term, it's a reasonable choice to use Signal Forms developer preview from 20.2 onward — just be prepared for the possibility of minor API changes.
