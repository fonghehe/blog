---
title: "Long Animation Frame API 實戰：從歸因盲區到 INP 精準最佳化"
date: 2026-08-14 15:23:41
tags:
  - 效能最佳化
readingTime: 7
description: "PerformanceObserver long-animation-frame（LoAF）API 解決了 Long Task API 無法歸因的核心缺陷。本文詳解 LoAF 的欄位含義、生產環境採集方案，並透過第三方指令碼阻塞、長渲染通道、樣式佈局抖動三個真實案例展示如何用 LoAF 驅動 INP 最佳化。"
wordCount: 1362
---

INP（Interaction to Next Paint）在 2024 年正式取代 FID 成為 Core Web Vitals 指標後，前端團隊面臨一個尷尬的現實：我們知道頁面回應慢，但不知道是誰讓它慢的。Long Task API 能告訴你「有一個 300ms 的長任務」，卻無法告訴你這 300ms 裡到底在執行什麼程式碼。這個歸因盲區在 2026 年被 Long Animation Frame API（LoAF）填上了。

## Long Task API 為什麼不夠用

Long Task API 自 Chrome 58 起可用，是效能監控的基礎設施之一。它的核心問題只有一個：**沒有歸因能力**。

```javascript
// Long Task API 能給你的全部資訊
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.duration);      // 320ms
    console.log(entry.startTime);     // 1234.56
    console.log(entry.attribution);   // undefined — 沒有任何歸因資訊
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

你知道了「有東西卡了 320ms」，然後呢？是哪個指令碼？是渲染還是指令碼執行？是樣式計算還是佈局？這些資訊全部缺失。在真實專案中，一個頁面的主執行緒可能同時執行自有程式碼、第三方 SDK、廣告指令碼、分析工具，Long Task API 無法區分它們。

這導致了一個普遍的困境：INP 分數差，DevTools 裡能看到長條，但無法在生產環境中系統性地定位和追蹤責任方。

## LoAF 的關鍵欄位

LoAF 透過 `PerformanceObserver` 的 `long-animation-frame` 類型暴露，每個條目代表一幀中超過 50ms 的動畫幀週期。它比 Long Task 多提供了四個關鍵維度：

```typescript
interface PerformanceLongAnimationFrameEntry extends PerformanceEntry {
  // 幀內所有指令碼執行的歸因列表
  scripts: PerformanceScriptTiming[];

  // 渲染開始時間（相對於 navigationStart）
  renderStart: number;

  // 樣式和佈局計算開始時間
  styleAndLayoutStart: number;

  // 幀內第一個使用者輸入事件的時間戳記（用於關聯互動）
  firstUIEventTimestamp: number;

  // 阻塞持續時間（排除平行處理工作後的純阻塞時間）
  blockingDuration: number;
}

interface PerformanceScriptTiming {
  name: string;              // 指令碼 URL 或 'unknown'
  entryType: 'script';
  startTime: number;
  duration: number;
  invoker: string;           // 呼叫者識別（如 'onclick', 'setTimeout'）
  invokerType: string;       // 'event-listener' | 'resolve-promise' | 'classic-script' | 'module-script' 等
  windowAttribution: string; // 'self' | 'descendant' | 'ancestor' | 'same-page' | 'other'
  sourceURL: string;         // 指令碼來源 URL
  sourceFunctionName: string;// 函式名稱（如果可取得）
  sourceCharPosition: number;// 原始碼中的字元位置
}
```

這些欄位的組合讓歸因成為可能。舉一個具體例子：

```javascript
const loafObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration < 100) continue; // 只關注 >100ms 的幀

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

當 `renderStart` 有值而 `scripts` 為空時，說明這一幀的時間主要花在渲染階段（樣式/佈局/繪製），而非指令碼執行。這是 Long Task API 完全無法區分的場景。

## 生產環境採集方案

LoAF 資料量比 Long Task 大得多（每幀可能包含多個 script 條目），直接全量上報會導致資料爆炸。生產環境需要取樣和緩衝策略。

### 取樣 + 緩衝 + sendBeacon

```typescript
class LoAFCollector {
  private buffer: object[] = [];
  private sampleRate: number;
  private maxBufferSize: number;
  private flushInterval: number;
  private timerId: number | null = null;

  constructor(options: { sampleRate?: number; maxBufferSize?: number; flushIntervalMs?: number } = {}) {
    this.sampleRate = options.sampleRate ?? 0.1; // 預設 10% 取樣
    this.maxBufferSize = options.maxBufferSize ?? 20;
    this.flushInterval = options.flushIntervalMs ?? 10000;
  }

  start() {
    if (!('PerformanceObserver' in window)) return;

    // 偵測瀏覽器是否支援 long-animation-frame
    const supported = PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');
    if (!supported) {
      console.warn('LoAF not supported, falling back to longtask');
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 取樣過濾
        if (Math.random() > this.sampleRate) continue;

        // 只收集有意義的長幀（>100ms）
        if (entry.duration < 100) continue;

        this.buffer.push(this.serialize(entry));

        if (this.buffer.length >= this.maxBufferSize) {
          this.flush();
        }
      }
    });

    // buffered: true 確保不遺失註冊前已產生的條目
    observer.observe({ type: 'long-animation-frame', buffered: true });

    // 定時重新整理緩衝區
    this.timerId = window.setInterval(() => this.flush(), this.flushInterval);

    // 頁面卸載前強制重新整理
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

    // sendBeacon 保證頁面卸載時也能傳送
    const sent = navigator.sendBeacon('/api/metrics/loaf', payload);
    if (!sent) {
      // fallback：fetch keepalive
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

// 初始化
const collector = new LoAFCollector({ sampleRate: 0.05, flushIntervalMs: 15000 });
collector.start();
```

關於 `buffered: true`：這個選項至關重要。PerformanceObserver 通常在 DOM ready 之後才註冊，但 LoAF 事件可能在頁面載入過程中就已經產生。`buffered: true` 讓 Observer 回溯並補發註冊前的條目，避免遺漏首屏階段的長幀。

## 真實案例診斷

### 案例一：第三方指令碼阻塞主執行緒

我們的內部儀表板頁面 INP p75 達到 480ms。LoAF 資料顯示：

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

歸因非常清晰：340ms 的長幀中，280ms 來自第三方分析 SDK 的 setTimeout 回呼，只有 30ms 是我們自己的點擊處理邏輯。

修復方式是將第三方指令碼延遲到使用者首次互動之後載入：

```typescript
// 延遲載入非關鍵第三方指令碼
let analyticsLoaded = false;

function loadAnalyticsOnInteraction() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  const script = document.createElement('script');
  script.src = 'https://analytics.vendor.com/sdk.js';
  script.async = true;
  document.head.appendChild(script);
}

// 在首次使用者互動時觸發
['click', 'keydown', 'pointerdown'].forEach((evt) => {
  document.addEventListener(evt, loadAnalyticsOnInteraction, { once: true, capture: true });
});
```

效果：INP p75 從 480ms 降到 120ms。

### 案例二：長渲染通道

另一個頁面的 LoAF 呈現出完全不同的模式：

```json
{
  "d": 220,
  "b": 40,
  "rs": 1580,
  "sl": 1620,
  "s": []
}
```

`scripts` 為空，`renderStart` 和 `styleAndLayoutStart` 有值，`blockingDuration` 僅 40ms。這說明 220ms 中有 180ms 花在渲染階段——樣式計算、佈局和繪製。

排查發現是該頁面使用了一個複雜的 CSS Grid 佈局，包含 200+ 個網格項目和大量巢狀的 `calc()` 運算式。每次資料更新觸發的 re-render 導致了完整的樣式重算。

修復方向：
- 將 `calc()` 替換為預計算的 CSS 變數
- 對網格容器新增 `contain: layout style`，限制樣式影響範圍
- 虛擬捲動減少 DOM 節點數

### 案例三：樣式/佈局抖動（Thrashing）

第三個案例的特徵是同一幀中出現多個交替的指令碼和渲染階段：

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

經典的讀寫交替模式：`updateItemHeight` 寫入樣式 → `measureItems` 讀取幾何屬性觸發強制同步佈局 → 循環往復。LoAF 的 `sourceFunctionName` 欄位直接指出了兩個函式的名稱。

修復方式是批次讀寫分離：

```typescript
// 修復前：讀寫交替
items.forEach((item) => {
  item.style.height = calculateHeight(item); // 寫
  const rect = item.getBoundingClientRect(); // 讀 → 強制同步佈局
  updateCache(item.id, rect);
});

// 修復後：先批次讀，再批次寫
const measurements = items.map((item) => ({
  id: item.id,
  rect: item.getBoundingClientRect(), // 批次讀
}));

items.forEach((item, i) => {
  item.style.height = calculateHeight(item); // 批次寫
  updateCache(measurements[i].id, measurements[i].rect);
});
```

## 將 LoAF 連接到 INP 改善

LoAF 的價值不僅在於單次診斷，更在於建立持續的效能歸因體系。我們在內部搭建了一個簡單的聚合看板：

1. **按指令碼 URL 聚合**：統計每個指令碼在所有 LoAF 中的累計耗時佔比，識別最大的效能貢獻者
2. **按 invoker 類型聚合**：區分 event-listener、timer、promise 等不同觸發來源，判斷是使用者互動導致的阻塞還是背景工作的干擾
3. **按頁面路徑聚合**：不同頁面的 LoAF 特徵不同，分頁面看才能精準定位
4. **趨勢對比**：將 LoAF 指標與 INP p75 疊加在同一時間軸上，驗證最佳化措施的實際效果

這套體系讓我們從「INP 高了 → 打開 DevTools 手動排查 → 猜一下改一改」的模式，轉變為「LoAF 自動歸因 → 定位到具體指令碼和函式 → 針對性修復 → 驗證效果」的閉環。

## 展望

LoAF 目前在 Chromium 系瀏覽器中穩定可用，Firefox 和 Safari 的支援還在推進中。對於需要跨瀏覽器覆蓋的場景，建議同時保留 Long Task API 作為降級方案，並在資料採集層做好 feature detection。

LoAF 不會讓 INP 自動變好，但它讓「為什麼 INP 不好」這個問題有了可回答的答案。在一個前端應用越來越複雜、第三方依賴越來越多的時代，歸因能力本身就是基礎設施。把 LoAF 接入你的效能監控體系，比盲目最佳化更有價值。
