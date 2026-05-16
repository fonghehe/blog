---
title: "Angular 19.2 Preview: Signal-based Forms Developer Preview and Routing Improvements"
date: 2025-01-31 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 19.2 is expected to ship in February 2025. Based on publicly available RFCs and GitHub PRs, two areas are worth knowing about in advance: **Signal-based"
---

Angular 19.2 is expected to ship in February 2025. Based on publicly available RFCs and GitHub PRs, two areas are worth knowing about in advance: **Signal-based Forms entering Developer Preview**, and further refinements to route lazy loading. This article previews the upcoming changes based on the current RC and community discussions.

> This article is based on Angular 19.2 RC and public RFCs; the final release may differ.

## Signal-based Forms Draft

Angular's `ReactiveFormsModule` (FormControl, FormGroup, FormArray) is built on RxJS Observables and doesn't integrate naturally with the Signals system. The Angular team is designing a brand-new Signal-based Forms API:

```typescript
// Current (ReactiveFormsModule, RxJS-based)
import { FormControl, FormGroup, Validators } from "@angular/forms";

const form = new FormGroup({
  name: new FormControl("", [Validators.required, Validators.minLength(2)]),
  email: new FormControl("", [Validators.required, Validators.email]),
});

// Must subscribe or use valueChanges Observable to react to changes
form.valueChanges.subscribe((val) => console.log(val));
```

```typescript
// Preview (Signal-based Forms, 19.2 Developer Preview draft)
import { formGroup, formControl, Validators } from "@angular/forms/signal"; // new package path TBD

const form = formGroup({
  name: formControl("", {
    validators: [Validators.required, Validators.minLength(2)],
  }),
  email: formControl("", {
    validators: [Validators.required, Validators.email],
  }),
});

// Signal: read value directly (no subscribe needed)
console.log(form.value()); // Signal<{ name: string; email: string }>
console.log(form.valid()); // Signal<boolean>
console.log(form.dirty()); // Signal<boolean>

// Template binding
// [formControl]="nameControl" is replaced by new Signal directives (TBD)
```

Template usage:

```html
<!-- New Signal Forms template binding (draft, API not yet finalized) -->
<form (ngSubmit)="submit()">
  <input [signalControl]="form.controls.name" />
  <span *ngIf="form.controls.name.errors()?.['required']"
    >Name is required</span
  >

  <input type="email" [signalControl]="form.controls.email" />
  <span *ngIf="form.controls.email.errors()?.['email']"
    >Invalid email format</span
  >

  <button [disabled]="!form.valid()">Submit</button>
</form>
```

Core advantages:

```typescript
// Seamless integration with computed()
const submitEnabled = computed(() => form.valid() && !isSubmitting());

// React to form changes inside effect()
effect(() => {
  if (form.value().email) {
    preloadUserSuggestions(form.value().email);
  }
});
```

## Routing Lazy Loading Improvements: Combining defer + Routes

Angular 19.2 explores combining `@defer` with route lazy loading:

```typescript
// Now: route lazy loading (module level)
const routes: Routes = [
  {
    path: "dashboard",
    loadComponent: () =>
      import("./dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
  },
];

// 19.2 exploration: @defer blocks inside route components also participate in route prefetch strategies
// i.e., when entering a route, only load visible content; load below-the-fold content on demand
```

## Server-Side Rendering Performance Improvements

Angular 19.2 improves the SSR Transfer State mechanism:

```typescript
// Before: all HTTP request results were serialized into Transfer State (potentially large)
// After: supports selective Transfer (only transfer what's needed)

@Injectable({ providedIn: "root" })
export class ApiService {
  private http = inject(HttpClient);

  getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`, {
      // New in 19.2: mark as not needing Transfer State
      context: new HttpContext().set(SKIP_TRANSFER_STATE, true),
    });
  }
}
```

## Developer Tooling Improvements

Angular DevTools adds a Signal tracing view in 19.2:

```
New in Angular DevTools 19.2:
- Signal dependency graph visualization: see which Signals affect which computed/effects
- Incremental Hydration status monitor: see which @defer blocks have hydrated and which haven't
- Zoneless performance analysis: compare change detection counts with and without zone.js
```

## How to Upgrade to 19.2 (after release)

```bash
ng update @angular/core@19.2 @angular/cli@19.2

# View the Signal Forms API (after release)
ng add @angular/forms@19.2
```

## Summary

The most anticipated feature in Angular 19.2 is Signal-based Forms — the largest modernization attempt in Angular's form system to date. Once it enters Developer Preview, combined with Signal Inputs/Outputs/Queries, the entire Angular component API will be completely free from the legacy "decorators + Observables" baggage. This is the transformational year for Angular's form system, and it's well worth watching closely.
