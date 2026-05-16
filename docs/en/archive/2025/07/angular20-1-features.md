---
title: "Angular 20.1: resource() API Improvements and Signal Forms Progress"
date: 2025-07-02 10:00:00
tags:
  - Angular
  - JavaScript
readingTime: 2
description: "Angular 20.1 was released at the end of June 2025, continuing the feature roadmap of Angular 20. This version focuses on improving the `resource()` API (promote"
---

Angular 20.1 was released at the end of June 2025, continuing the feature roadmap of Angular 20. This version focuses on improving the `resource()` API (promoted from experimental to developer preview) and advancing the stabilization of Signal Forms.

## resource() API Promoted to Developer Preview

The `resource()` introduced in Angular 20 enters developer preview in 20.1 after API adjustments:

```typescript
import { resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({ standalone: true, ... })
export class UserListComponent {
  private http = inject(HttpClient);

  searchQuery = signal('');
  currentPage = signal(1);

  // httpResource: a resource variant optimized for HttpClient (new in 20.1)
  usersResource = httpResource<User[]>(() =>
    `/api/users?q=${this.searchQuery()}&page=${this.currentPage()}`
  );

  // Or generic resource (supports arbitrary async logic)
  statsResource = resource({
    request: this.currentPage,
    loader: async ({ request: page, abortSignal }) => {
      // New in 20.1: AbortSignal support — automatically cancels the previous request when switching
      const res = await fetch(`/api/stats?page=${page}`, { signal: abortSignal });
      return res.json() as Promise<Stats>;
    }
  });
}
```

### httpResource: Optimized for Angular HTTP

```typescript
import { httpResource } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class ProductDetailComponent {
  productId = input.required<string>();

  // httpResource automatically:
  // 1. Processes Angular's HTTP interceptor chain
  // 2. Writes/reads Transfer State in SSR
  // 3. Supports withCredentials, headers, and other configs
  product = httpResource<Product>(() => ({
    url: `/api/products/${this.productId()}`,
    headers: { 'Accept-Language': 'zh-CN' }
  }));
}
```

## Signal Forms: Enhanced Validators

Angular 20.1 adds async validator support to Signal Forms:

```typescript
import { formControl, Validators, asyncValidator } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// Async validator: check username uniqueness
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

  // New: pending() Signal — whether any async validation is in progress
  isValidating = computed(() =>
    Object.values(this.form.controls).some(c => c.pending())
  );
}
```

In the template:

```html
<input [sfControl]="form.controls.username" />
@if (form.controls.username.pending()()) {
<small>Checking username availability...</small>
} @if (form.controls.username.hasError('taken')()) {
<small>This username is already taken</small>
}
```

## Incremental Hydration: hydrate on timer

Angular 20.1 adds the `hydrate on timer` trigger condition:

```html
<!-- Hydrate 3 seconds after page load (suitable for low-priority ads/recommendations) -->
@defer (hydrate on timer(3000)) {
<recommendation-sidebar />
}

<!-- Combined condition: hydrate only when in viewport AND idle -->
@defer (hydrate on viewport; hydrate when isLoggedIn()) {
<user-personalized-feed />
}
```

## DevTools Update

Angular DevTools 20.1 adds resource tracking:

```
New panel: Resources
- Shows all currently active resource() instances
- Status: loading / success / error
- Last loaded time
- Request parameter snapshot
- Manual reload button
```

## Summary

The core progress of Angular 20.1 is the maturation of the `resource()` ecosystem — `httpResource()` seamlessly integrates Angular HTTP with the new declarative data-flow pattern, and async validators give Signal Forms the complete functionality needed for production. Following Angular's release cadence, 20.2 (August) and 21 (November) will continue to refine this system.
