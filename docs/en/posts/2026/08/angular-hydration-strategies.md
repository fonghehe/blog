---
title: "Angular 23 Hydration Deep Dive: Incremental Hydration and Zoneless in Practice"
date: 2026-08-27 16:48:05
tags:
  - Angular
readingTime: 8
description: "Angular 23 hydration is no longer all-or-nothing activation. This article covers @defer hydrate triggers, selective hydration boundaries, zoneless integration, TBT/INP measurements, and differing strategies for content pages versus dashboards — with real data and pitfalls from a marketing site migration."
wordCount: 3300
---

Angular 17 introduced SSR hydration, solving the long-standing re-render flicker problem. But default full hydration is too heavy for content pages — a marketing landing page might have 20 components, with only 3 visible above the fold while the remaining 17 silently consume main thread time doing hydration in the background, dragging down TBT and INP. Angular 23's incremental hydration makes fine-grained control possible.

We recently migrated a marketing site with 500K daily page views from Angular 21 full hydration to Angular 23 incremental hydration + zoneless. This article documents the decisions, data, and pitfalls along the way.

## How Incremental Hydration Works

Angular 23 connects `@defer` with hydration. Previously, `@defer` only controlled client-side rendering timing (lazy loading); during server rendering, all defer blocks still output complete HTML. Now you can specify hydration trigger conditions for defer blocks:

```html
<!-- Hydrate when visible -->
@defer (hydrate on visible) {
  <product-recommendations />
}

<!-- Hydrate on user interaction -->
@defer (hydrate on interaction) {
  <comment-section />
}

<!-- Hydrate when idle -->
@defer (hydrate on idle) {
  <related-articles />
}

<!-- Custom condition -->
@defer (hydrate when shouldHydrateMap()) {
  <interactive-map [data]="mapData()" />
}
```

The key distinction: `@defer` blocks without `hydrate` **don't output HTML** during server rendering (pure client-side lazy loading); blocks with `hydrate on ...` render full HTML on the server but only activate event bindings and change detection on the client when the trigger condition is met. Users see content immediately without paying JS execution cost for interactivity in non-visible areas.

Use cases for each trigger:

| Trigger | Server Outputs HTML | Client Activation Timing | Typical Components |
|---------|-------------------|------------------------|--------------------|
| `on visible` | Yes | Enters viewport | Recommendation lists, FAQ, footer |
| `on interaction` | Yes | click/focus/touch | Comment sections, forms, accordions |
| `on idle` | Yes | requestIdleCallback | Non-critical analytics, social sharing |
| `when condition()` | Yes | Signal becomes true | Programmatically controlled scenarios |

## Principles for Selective Hydration Boundaries

Not every component suits deferred hydration. Our classification criteria:

**Must hydrate immediately**: navigation bar, search box, cart entry point, login status indicator. These are above the fold and need instant interaction response — deferred hydration causes unresponsive clicks.

**Can defer hydration**: recommendation modules below product details, user review sections, SEO long-form content blocks, third-party embeds (maps, videos). These are either below the fold or don't need instant interaction.

**Shouldn't use hydration at all**: purely presentational content that never needs interaction. Use `ngNonBindable` or raw HTML directly — don't even wrap it in an Angular component.

A common mistake in practice is marking too many components as `on interaction`. If a user clicks a component on the first screen that was supposed to hydrate `on visible`, they experience a phase of "looks clickable but nothing happens" before activation kicks in. The UX damage from this exceeds the cost of spending a few extra milliseconds on full hydration.

## Integration with Zoneless Change Detection

In zoneless mode, there's no Zone.js monkey-patching — change detection is driven entirely by signals and explicit `markForCheck`. This pairs naturally with incremental hydration: each defer block only needs to establish its own signal subscriptions upon hydration, without a global Zone tracking async operations.

```typescript
// Zoneless app config
bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
  ],
});
```

Note the `withIncrementalHydration()` provider. Without it, Angular falls back to full hydration even if your template includes `hydrate on ...`. This is an easily overlooked configuration item in 23.0.

The combined effect of zoneless + incremental hydration is twofold: fewer components need hydration, and each hydrated component no longer carries Zone.js runtime overhead. In our testing, the combined benefit exceeded the sum of each used individually.

## Measuring Hydration Cost: TBT and INP Before and After

We set up continuous monitoring with Lighthouse CI + Web Vitals API before and after migration. Data comes from the same set of URLs (20 marketing pages + 5 functional pages), sampled over one week at p75:

| Metric | Full Hydration (v21+Zone.js) | Incremental Hydration (v23+Zoneless) | Change |
|--------|------------------------------|--------------------------------------|--------|
| TBT (p75) | 380ms | 140ms | -63% |
| INP (p75) | 290ms | 110ms | -62% |
| LCP (p75) | 2.1s | 1.9s | -10% |
| CLS (p75) | 0.02 | 0.01 | -50% |
| JS Bundle (above-fold) | 420KB | 285KB | -32% |

TBT and INP improved most because hydration work for many below-the-fold components was deferred or eliminated. LCP improvement was modest since LCP primarily depends on image and font loading — hydration has limited direct impact. CLS improvement came from proper use of `@defer` block placeholders.

JS Bundle shrank because zoneless removes Zone.js (~40KB gzipped), plus some defer block code was split into lazy chunks.

One measurement caveat: don't rely solely on Lighthouse lab data. Lab environments run on simulated devices where hydration's time share gets amplified. Field data (real user metrics) is the ultimate benchmark. We saw INP good rate improve from 78% to 94% in field data.

## Content Pages vs Dashboards: Different Strategies

Marketing content pages and functional dashboards need entirely different hydration strategies.

**Content pages (marketing site)**: primarily read-oriented, with interaction concentrated in a few components (CTA buttons, forms, search). Strategy: aggressively defer hydration — above-the-fold CTAs hydrate immediately, everything else uses `on visible` or `on interaction`. Goal: let readers scroll and read smoothly before JS finishes loading.

```html
<!-- Typical marketing page structure -->
<header>
  <navbar /> <!-- Hydrate immediately -->
</header>

<main>
  <hero-section /> <!-- Hydrate immediately, contains CTA -->

  @defer (hydrate on visible) {
    <feature-highlights />
  }

  @defer (hydrate on visible) {
    <testimonial-carousel />
  }

  @defer (hydrate on interaction) {
    <pricing-calculator />
  }

  @defer (hydrate on idle) {
    <seo-long-form-content />
  }
</main>

<footer>
  @defer (hydrate on visible) {
    <site-footer />
  }
</footer>
```

**Dashboards**: nearly all components need instant interaction. Strategy: minimize deferred hydration — only use `on visible` for components definitively below the fold with high loading costs; everything else hydrates immediately. Goal: provide full interactivity within the first screen.

```html
<!-- Typical dashboard structure -->
<dashboard-layout>
  <sidebar-nav /> <!-- Hydrate immediately -->
  <top-bar /> <!-- Hydrate immediately -->

  <main-content>
    <kpi-cards /> <!-- Hydrate immediately -->
    <chart-panel /> <!-- Hydrate immediately -->

    @defer (hydrate on visible) {
      <detailed-data-table /> <!-- Table is long, defer collapsed area -->
    }

    @defer (hydrate on interaction) {
      <export-dialog /> <!-- Dialog, only needed on click -->
    }
  </main-content>
</dashboard-layout>
```

## Pitfalls Encountered

**Event Replay Flicker**. Angular records user events before hydration completes and replays them afterward. If a user rapidly clicks an `on interaction` button during hydration, event replay can cause visual flicker — the button shows an inactive state first, then jumps to active on replay. Solution: add CSS transitions for smooth visual changes, or in extreme cases switch to `on visible` for earlier hydration.

**SEO and Deferred Content**. Search engines crawl server-rendered HTML, but `@defer` block behavior depends on the trigger. `on visible` and `on idle` content exists in the HTML and crawlers can see it. `on interaction` content also exists in the initial HTML (that's the premise of incremental hydration). But accidentally using plain `@defer` without `hydrate` means that block won't render on the server, losing SEO content. Every code review must confirm defer blocks include `hydrate`.

**Signal Initialization Timing**. In zoneless mode, signals inside defer blocks are created only when the component instantiates. If a parent passes data to a deferred child via input signals, ensure the signal already has a value when the child hydrates. Otherwise you'll see a brief empty-state flash. Wrapping with `@if (data())` or setting defaults on signals prevents this.

**Increased Testing Complexity**. In unit tests, components with `@defer (hydrate on visible)` don't render by default. You need to configure `deferBlockBehavior: DeferBlockBehavior.Playthrough` in TestBed to force-render all defer blocks, or manually trigger them individually. This adds test configuration overhead.

**Third-Party Library Compatibility**. Some UI libraries assume immediate hydration in their internal components. For example, certain carousel libraries calculate slide width before hydration and get 0. When this happens, either submit a PR to fix it or switch that component to immediate hydration.

## Summary

Angular 23's incremental hydration turns hydration from a global toggle into a per-component dial. Combined with zoneless, the performance gains are significant — our marketing site's TBT dropped 63%, and INP good rate went from 78% to 94%. But fine-grained control brings new decision burden: every component needs a trigger decision, and getting it wrong can hurt UX or SEO. Start with content pages to build experience before extending to interactive applications. Use field data as the primary metric, lab data as reference only.
