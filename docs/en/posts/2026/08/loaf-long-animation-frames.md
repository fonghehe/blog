---
title: "Long Animation Frame API in Practice: From Attribution Blind Spots to Precise INP Optimization"
date: 2026-08-14 15:23:41
tags:
  - Performance
readingTime: 7
description: "The PerformanceObserver long-animation-frame (LoAF) API solves the core attribution gap in the Long Task API. This article explains LoAF's fields, production collection strategies, and demonstrates how to drive INP optimization through three real-world cases: third-party script blocking, long render pipelines, and style/layout thrashing."
wordCount: 3100
---

After INP (Interaction to Next Paint) officially replaced FID as a Core Web Vitals metric in 2024, frontend teams faced an awkward reality: we know the page is slow to respond, but we don't know what's making it slow. The Long Task API can tell you "there was a 300ms long task," but it can't tell you what code was actually executing during those 300ms. That attribution blind spot was filled in 2026 by the Long Animation Frame API (LoAF).

## Why the Long Task API Falls Short

The Long Task API has been available since Chrome 58 and is one of the foundational tools for performance monitoring. It has one fundamental problem: **no attribution capability**.

```javascript
// All the information the Long Task API gives you
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.duration);      // 320ms
    console.log(entry.startTime);     // 1234.56
    console.log(entry.attribution);   // undefined — no attribution info at all
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

You now know "something blocked for 320ms," then what? Which script? Was it rendering or script execution? Style calculation or layout? All of that information is missing. In real projects, a page's main thread might simultaneously run first-party code, third-party SDKs, ad scripts, and analytics tools — the Long Task API can't distinguish between them.

This leads to a common predicament: poor INP scores, long bars visible in DevTools, but no way to systematically identify and track the responsible parties in production.

## Key LoAF Fields

LoAF is exposed via `PerformanceObserver` with the `long-animation-frame` type. Each entry represents an animation frame cycle exceeding 50ms within a single frame. It provides four key dimensions beyond what Long Task offers:

```typescript
interface PerformanceLongAnimationFrameEntry extends PerformanceEntry {
  // Attribution list of all script executions within the frame
  scripts: PerformanceScriptTiming[];

  // Render start time (relative to navigationStart)
  renderStart: number;

  // Style and layout calculation start time
  styleAndLayoutStart: number;

  // Timestamp of the first user input event within the frame (for correlating interactions)
  firstUIEventTimestamp: number;

  // Blocking duration (pure blocking time excluding parallelizable work)
  blockingDuration: number;
}

interface PerformanceScriptTiming {
  name: string;              // Script URL or 'unknown'
  entryType: 'script';
  startTime: number;
  duration: number;
  invoker: string;           // Invoker identifier (e.g., 'onclick', 'setTimeout')
  invokerType: string;       // 'event-listener' | 'resolve-promise' | 'classic-script' | 'module-script', etc.
  windowAttribution: string; // 'self' | 'descendant' | 'ancestor' | 'same-page' | 'other'
  sourceURL: string;         // Script source URL
  sourceFunctionName: string;// Function name (if available)
  sourceCharPosition: number;// Character position in source code
}
```

The combination of these fields makes attribution possible. Here's a concrete example:

```javascript
const loafObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration < 100) continue; // Only focus on frames >100ms

    const report = {
      duration: entry.duration,
      blockingDuration: entry.blockingDuration,
      scriptCount: entry.scripts.length,
      scripts: entry.scripts.map((s) => ({
        url: s.name,
        duration: s.duration,
        invoker: s.invoker,
        invokerType: s.invokerType,
        functionName: s.sourceFunctionName,
        charPosition: s.sourceCharPosition,
      })),
      renderPhase: entry.renderStart > 0
        ? { start: entry.renderStart, layoutStart: entry.styleAndLayoutStart }
        : null,
    };

    sendToAnalytics(report);
  }
});

loafObserver.observe({ type: 'long-animation-frame', buffered: true });
```

When `renderStart` has a value but `scripts` is empty, it means the frame's time was primarily spent in the rendering phase (style/layout/paint) rather than script execution. This is a scenario the Long Task API simply cannot distinguish.

## Production Collection Strategy

LoAF data volume is much larger than Long Task (each frame may contain multiple script entries). Reporting everything raw would cause a data explosion. Production environments need sampling and buffering strategies.

### Sampling + Buffering + sendBeacon

```typescript
class LoAFCollector {
  private buffer: object[] = [];
  private sampleRate: number;
  private maxBufferSize: number;
  private flushInterval: number;
  private timerId: number | null = null;

  constructor(options: { sampleRate?: number; maxBufferSize?: number; flushIntervalMs?: number } = {}) {
    this.sampleRate = options.sampleRate ?? 0.1; // Default 10% sampling
    this.maxBufferSize = options.maxBufferSize ?? 20;
    this.flushInterval = options.flushIntervalMs ?? 10000;
  }

  start() {
    if (!('PerformanceObserver' in window)) return;

    // Check browser support for long-animation-frame
    const supported = PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');
    if (!supported) {
      console.warn('LoAF not supported, falling back to longtask');
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Apply sampling filter
        if (Math.random() > this.sampleRate) continue;

        // Only collect meaningful long frames (>100ms)
        if (entry.duration < 100) continue;

        this.buffer.push(this.serialize(entry));

        if (this.buffer.length >= this.maxBufferSize) {
          this.flush();
        }
      }
    });

    // buffered: true ensures entries produced before registration aren't lost
    observer.observe({ type: 'long-animation-frame', buffered: true });

    // Periodically flush the buffer
    this.timerId = window.setInterval(() => this.flush(), this.flushInterval);

    // Force flush before page unload
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  private serialize(entry: any): object {
    return {
      t: Date.now(),
      d: Math.round(entry.duration),
      b: Math.round(entry.blockingDuration),
      rs: entry.renderStart ? Math.round(entry.renderStart) : null,
      sl: entry.styleAndLayoutStart ? Math.round(entry.styleAndLayoutStart) : null,
      s: entry.scripts?.map((s: any) => ({
        u: s.name,
        d: Math.round(s.duration),
        i: s.invoker,
        it: s.invokerType,
        fn: s.sourceFunctionName || undefined,
        cp: s.sourceCharPosition >= 0 ? s.sourceCharPosition : undefined,
      })) || [],
      p: location.pathname,
    };
  }

  private flush() {
    if (this.buffer.length === 0) return;

    const payload = JSON.stringify(this.buffer.splice(0));

    // sendBeacon guarantees delivery even during page unload
    const sent = navigator.sendBeacon('/api/metrics/loaf', payload);
    if (!sent) {
      // Fallback: fetch with keepalive
      fetch('/api/metrics/loaf', {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  }

  stop() {
    if (this.timerId !== null) clearInterval(this.timerId);
    this.flush();
  }
}

// Initialize
const collector = new LoAFCollector({ sampleRate: 0.05, flushIntervalMs: 15000 });
collector.start();
```

About `buffered: true`: this option is critical. PerformanceObserver is typically registered after DOM ready, but LoAF events may have already occurred during page load. `buffered: true` lets the Observer look back and deliver entries that were produced before registration, preventing missed long frames during the initial render phase.

## Real-World Diagnostic Cases

### Case 1: Third-Party Script Blocking the Main Thread

Our internal dashboard page had an INP p75 of 480ms. LoAF data revealed:

```json
{
  "d": 340,
  "b": 310,
  "rs": null,
  "s": [
    { "u": "https://analytics.vendor.com/sdk.js", "d": 280, "i": "setTimeout", "it": "classic-script" },
    { "u": "https://cdn.example.com/app/dashboard.js", "d": 30, "i": "onclick", "it": "event-listener" }
  ]
}
```

Attribution is crystal clear: of the 340ms long frame, 280ms came from a third-party analytics SDK's setTimeout callback, while only 30ms was our own click handler logic.

The fix was to defer loading the third-party script until after the user's first interaction:

```typescript
// Defer non-critical third-party scripts
let analyticsLoaded = false;

function loadAnalyticsOnInteraction() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  const script = document.createElement('script');
  script.src = 'https://analytics.vendor.com/sdk.js';
  script.async = true;
  document.head.appendChild(script);
}

// Trigger on first user interaction
['click', 'keydown', 'pointerdown'].forEach((evt) => {
  document.addEventListener(evt, loadAnalyticsOnInteraction, { once: true, capture: true });
});
```

Result: INP p75 dropped from 480ms to 120ms.

### Case 2: Long Render Pipeline

Another page showed a completely different LoAF pattern:

```json
{
  "d": 220,
  "b": 40,
  "rs": 1580,
  "sl": 1620,
  "s": []
}
```

`scripts` is empty, `renderStart` and `styleAndLayoutStart` have values, and `blockingDuration` is only 40ms. This means 180ms of the 220ms was spent in the rendering phase — style calculation, layout, and paint.

Investigation revealed the page used a complex CSS Grid layout with 200+ grid items and numerous nested `calc()` expressions. Every data update triggered a re-render that caused a full style recalculation.

Fix direction:
- Replace `calc()` with pre-computed CSS variables
- Add `contain: layout style` to the grid container to limit style invalidation scope
- Use virtual scrolling to reduce DOM node count

### Case 3: Style/Layout Thrashing

The third case featured multiple alternating script and render phases within a single frame:

```json
{
  "d": 380,
  "b": 350,
  "s": [
    { "u": "/app/list.js", "d": 40, "i": "forEach", "fn": "updateItemHeight" },
    { "u": "/app/list.js", "d": 60, "i": "getComputedStyle", "fn": "measureItems" },
    { "u": "/app/list.js", "d": 35, "i": "forEach", "fn": "updateItemHeight" },
    { "u": "/app/list.js", "d": 55, "i": "offsetHeight", "fn": "measureItems" }
  ]
}
```

Classic read-write interleaving pattern: `updateItemHeight` writes styles → `measureItems` reads geometry properties triggering forced synchronous layout → repeat. LoAF's `sourceFunctionName` field directly identified both function names.

The fix is to batch reads and writes separately:

```typescript
// Before: interleaved reads and writes
items.forEach((item) => {
  item.style.height = calculateHeight(item); // write
  const rect = item.getBoundingClientRect(); // read → forces synchronous layout
  updateCache(item.id, rect);
});

// After: batch reads first, then batch writes
const measurements = items.map((item) => ({
  id: item.id,
  rect: item.getBoundingClientRect(), // batch read
}));

items.forEach((item, i) => {
  item.style.height = calculateHeight(item); // batch write
  updateCache(measurements[i].id, measurements[i].rect);
});
```

## Connecting LoAF to INP Improvements

LoAF's value goes beyond one-off diagnostics — it enables building a continuous performance attribution system. We built a simple aggregation dashboard internally:

1. **Aggregate by script URL**: tally each script's cumulative duration share across all LoAFs to identify the biggest performance contributors
2. **Aggregate by invoker type**: distinguish event-listener, timer, promise, and other trigger sources to determine whether blocking comes from user interactions or background tasks
3. **Aggregate by page path**: different pages exhibit different LoAF characteristics; per-page analysis enables precise targeting
4. **Trend comparison**: overlay LoAF metrics with INP p75 on the same timeline to validate the actual impact of optimization efforts

This system transformed us from a pattern of "INP is high → open DevTools for manual investigation → guess and tweak" into a closed loop of "LoAF auto-attributes → pinpoint specific scripts and functions → targeted fixes → validate results."

## Looking Ahead

LoAF is stable in Chromium-based browsers today, with Firefox and Safari support still in progress. For scenarios requiring cross-browser coverage, I recommend keeping the Long Task API as a fallback and implementing proper feature detection in your data collection layer.

LoAF won't automatically make your INP better, but it makes the question "why is INP bad?" answerable. In an era where frontend applications grow ever more complex and third-party dependencies proliferate, attribution capability is infrastructure in its own right. Integrating LoAF into your performance monitoring system delivers more value than blind optimization.
