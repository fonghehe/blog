---
title: "前端內存泄漏診斷與防禦體系：從 Chrome DevTools 到自動化檢測"
date: 2026-07-22 16:00:49
tags:
  - 性能優化
readingTime: 8
description: "系統梳理前端內存泄漏的常見模式、Chrome DevTools 診斷方法、弱引用的正確使用，以及基於 Puppeteer 的自動化內存泄漏檢測方案。"
wordCount: 1185
---

前端內存泄漏是一個"溫水煮青蛙"式的問題。在開發階段，幾 MB 的泄漏幾乎無感；但當應用長時間運行後，頁面逐漸卡頓、崩潰，用戶流失已經發生。隨着 SPA 的普及和前端應用複雜度的上升，內存管理已經從"可選優化"變成"必備能力"。

## 前端內存泄漏的常見模式

### 1. 閉包引用

閉包是 JavaScript 的核心特性，但也是內存泄漏的重災區。一個常見的陷阱是閉包意外捕獲了大對象：

```javascript
// 泄漏模式：閉包意外持有大對象
function createHandler() {
  const hugeData = new Array(100000).fill({ name: 'data', value: Math.random() });

  return function handleClick() {
    // 只用了一行數據，但整個 hugeData 被閉包持有
    console.log(hugeData[0].name);
  };
}

const handler = createHandler();
document.getElementById('btn').addEventListener('click', handler);
// 即使只需要 hugeData[0]，整個數組都無法被 GC
```

修複方式——精確控制閉包捕獲的範圍：

```javascript
function createHandler() {
  const hugeData = new Array(100000).fill({ name: 'data', value: Math.random() });
  const firstName = hugeData[0].name; // 只提取需要的值

  return function handleClick() {
    console.log(firstName);
  };
  // hugeData 在 createHandler 返回後即可被 GC
}
```

### 2. 事件監聽器未移除

這是最經典的泄漏模式。添加了事件監聽器但忘記移除，或者移除時引用了不同的函數：

```javascript
// 泄漏模式：匿名函數無法移除
function setupListener(element) {
  element.addEventListener('click', () => {
    console.log('clicked');
  });
  // 後續無法 removeEventListener，因爲匿名函數沒有引用
}

// 泄漏模式：移除的函數引用不同
function setupListener(element) {
  this.handle = () => { console.log('clicked'); };
  element.addEventListener('click', this.handle);
}
function cleanup(element) {
  // 錯誤！每次 bind 都創建新函數，與 addEventListener 的引用不同
  element.removeEventListener('click', this.handle.bind(this));
}

// 正確做法
function setupListener(element) {
  this.handle = () => { console.log('clicked'); };
  element.addEventListener('click', this.handle);
}
function cleanup(element) {
  element.removeEventListener('click', this.handle); // 同一引用
}
```

### 3. 定時器未清除

```javascript
// 泄漏模式：setInterval 永不清除
function startPolling() {
  setInterval(() => {
    fetch('/api/status').then(res => res.json()).then(data => {
      this.updateUI(data); // 持有組件實例引用
    });
  }, 5000);
}

// 正確做法
class PollingService {
  private timerId: number | null = null;

  start() {
    this.timerId = window.setInterval(() => {
      this.poll();
    }, 5000);
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
```

### 4. DOM 引用

JavaScript 中持有 DOM 元素引用，即使元素已從文檔中移除，也無法被 GC：

```javascript
// 泄漏模式：變量持有已移除的 DOM 元素
const buttons = [];
function addButton() {
  const btn = document.createElement('button');
  document.body.appendChild(btn);
  buttons.push(btn); // 持有引用
}

function removeButtons() {
  buttons.forEach(btn => btn.remove());
  // DOM 元素從文檔移除了，但 buttons 數組仍持有引用 → 泄漏
  buttons.length = 0; // 修復：清空引用
}
```

### 5. 全局變量

```javascript
// 泄漏模式：意外創建全局變量
function processData() {
  cache = {}; // 沒有 let/const/var，掛載到 window
  for (let i = 0; i < 10000; i++) {
    cache[i] = { data: new ArrayBuffer(1024) };
  }
}
// cache 永遠不會被回收
```

## Chrome DevTools Memory 面板

### Heap Snapshot 三種視圖

Chrome DevTools 的 Memory 面板提供三種堆快照視圖：

- **Summary**：按構造函數分組，顯示對象數量和內存佔用
- **Comparison**：對比兩個快照之間的差異，定位增量對象
- **Containment**：從 GC 根開始的引用鏈，分析對象爲何無法被回收

### 三種快照對比法

這是定位內存泄漏最有效的方法：

1. **拍第一張快照**（Snapshot 1）：操作前的基線
2. **執行操作**：比如路由切換、打開/關閉彈窗
3. **拍第二張快照**（Snapshot 2）：操作後的狀態
4. **重複操作**：再次執行相同操作
5. **拍第三張快照**（Snapshot 3）
6. **對比 Snapshot 1 和 Snapshot 3**：如果相同操作後內存持續增長，說明存在泄漏

在 Comparison 視圖中，關注 `# Delta` 列——正數表示新增對象數。如果某類對象的 `# Delta` 在重複操作後持續增長，即爲泄漏候選。

### Allocation Timeline

Allocation Timeline 模式可以實時記錄內存分配情況：

```javascript
// 在 DevTools 控制臺中標記時間點
console.log('開始操作');
// ... 執行操作 ...
console.mark('操作完成');
```

在時間線上可以看到每次內存分配的峯值。如果分配後的內存沒有回落到操作前的水平，說明有對象未被回收。

## 弱引用的正確使用

### WeakMap：對象關聯的利器

當你需要爲對象附加額外數據但不希望阻止對象被 GC 時，WeakMap 是正確的選擇：

```javascript
// 泄漏模式：用 Map 緩存 DOM 元素的數據
const elementData = new Map();

function cacheData(element, data) {
  elementData.set(element, data);
}
// element 從 DOM 移除後，Map 仍持有引用 → 泄漏

// 正確做法：WeakMap 不阻止 key 被 GC
const elementData = new WeakMap();

function cacheData(element, data) {
  elementData.set(element, data);
}
// element 被 GC 時，WeakMap 中對應的條目自動消失
```

### WeakRef：持有弱引用

`WeakRef` 允許你持有一個對象的弱引用，不阻止該對象被垃圾回收。適用於緩存場景：

```javascript
class WeakCache {
  private cache = new Map<string, WeakRef<any>>();

  get<T>(key: string, factory: () => T): T {
    const ref = this.cache.get(key);
    if (ref) {
      const value = ref.deref();
      if (value !== undefined) {
        return value;
      }
    }
    const value = factory();
    this.cache.set(key, new WeakRef(value));
    return value;
  }
}

// 使用：緩存大對象，內存緊張時自動釋放
const cache = new WeakCache();
const getData = (id: string) => cache.get(id, () => fetchHugeData(id));
```

### FinalizationRegistry：對象回收通知

配合 WeakRef 使用，可以在對象被 GC 時執行清理邏輯：

```javascript
const registry = new FinalizationRegistry((heldValue: string) => {
  console.log(`對象 ${heldValue} 已被垃圾回收`);
  // 執行清理邏輯，如關閉 WebSocket、釋放 WebGL 資源
});

class ResourceManager {
  private resource: any;

  constructor(id: string) {
    this.resource = createResource();
    registry.register(this, id, this.resource);
    // 第三個參數是 unregister token
  }

  dispose() {
    registry.unregister(this.resource);
    this.resource.close();
    this.resource = null;
  }
}
```

注意：FinalizationRegistry 的回調是異步的，不保證及時執行，不能依賴它做關鍵資源釋放。它更適合用於調試和可選的清理工作。

## SPA 路由切換時的內存管理

SPA 的路由切換是內存泄漏的高發區。每次路由切換時，舊頁面組件卸載，如果清理不徹底，組件實例及其關聯資源會持續累積。

```typescript
// React 路由切換的通用清理模式
function usePageData(pageId: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // 清除上一次的數據，釋放內存
    setData(null);

    fetchData(pageId, { signal: controller.signal })
      .then(result => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      });

    return () => {
      cancelled = true;
      controller.abort(); // 中止未完成的請求
    };
  }, [pageId]);

  return data;
}
```

### Vue 組件卸載清理

```typescript
// Vue 3 Composition API 的清理模式
import { onMounted, onUnmounted, ref } from 'vue';

export function useResizeObserver(target: Ref<HTMLElement | null>) {
  const width = ref(0);
  const height = ref(0);
  let observer: ResizeObserver | null = null;

  onMounted(() => {
    if (!target.value) return;

    observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      width.value = rect.width;
      height.value = rect.height;
    });
    observer.observe(target.value);
  });

  onUnmounted(() => {
    // 關鍵：斷開 observer，釋放對 DOM 的引用
    observer?.disconnect();
    observer = null;
  });

  return { width, height };
}
```

### React 組件卸載清理

```typescript
function useWebSocket(url: string) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);
    const handleMessage = (event: MessageEvent) => {
      setMessages(prev => [...prev, event.data]);
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      // 清理順序：先移除監聽，再關閉連接
      ws.removeEventListener('message', handleMessage);
      ws.close();
    };
  }, [url]);

  return messages;
}
```

## 自動化內存泄漏檢測：Puppeteer + 快照對比

手動用 DevTools 檢查內存泄漏效率低下，難以持續。以下是基於 Puppeteer 的自動化檢測方案：

```typescript
// memory-leak-detector.ts
import puppeteer, { Browser, Page } from 'puppeteer';

interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

async function getMemoryUsage(page: Page): Promise<MemorySnapshot> {
  const metrics = await page.metrics();
  return {
    usedJSHeapSize: metrics.JSHeapUsedSize,
    totalJSHeapSize: metrics.JSHeapTotalSize,
    jsHeapSizeLimit: metrics.JSHeapSizeLimit,
  };
}

async function forceGC(page: Page): Promise<void> {
  // 需要 --expose-gc 標誌啓動 Chrome
  await page.evaluate(() => {
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }
  });
}

async function detectMemoryLeak(
  url: string,
  action: (page: Page) => Promise<void>,
  iterations: number = 5
): Promise<MemoryLeakReport> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--expose-gc', '--enable-precise-memory-info'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    // 預熱：執行一次操作，初始化緩存等
    await action(page);
    await forceGC(page);

    // 基線快照
    const baseline = await getMemoryUsage(page);

    const snapshots: MemorySnapshot[] = [baseline];

    // 重複執行操作，檢測內存增長趨勢
    for (let i = 0; i < iterations; i++) {
      await action(page);
      await forceGC(page);
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待 GC 完成
      snapshots.push(await getMemoryUsage(page));
    }

    return analyzeSnapshots(snapshots);
  } finally {
    await browser.close();
  }
}

interface MemoryLeakReport {
  isLeaking: boolean;
  baselineHeap: number;
  finalHeap: number;
  growthRate: number; // 每次操作的平均增長（字節）
  snapshots: MemorySnapshot[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

function analyzeSnapshots(snapshots: MemorySnapshot[]): MemoryLeakReport {
  const heapSizes = snapshots.map(s => s.usedJSHeapSize);
  const baseline = heapSizes[0];
  const final = heapSizes[heapSizes.length - 1];

  // 計算線性回歸斜率，判斷增長趨勢
  const n = heapSizes.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = heapSizes.reduce((a, b) => a + b, 0);
  const sumXY = heapSizes.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = heapSizes.reduce((sum, _, x) => sum + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  const growthRate = slope;
  const isLeaking = growthRate > 50000; // 閾值：每次操作增長 > 50KB

  return {
    isLeaking,
    baselineHeap: baseline,
    finalHeap: final,
    growthRate,
    snapshots,
    trend: slope > 50000 ? 'increasing' : slope < -10000 ? 'decreasing' : 'stable',
  };
}

// 使用示例
const report = await detectMemoryLeak(
  'http://localhost:3000/dashboard',
  async (page) => {
    // 模擬路由切換：進入詳情頁再返回
    await page.click('[data-nav="detail"]');
    await page.waitForSelector('[data-page="detail"]');
    await page.click('[data-nav="back"]');
    await page.waitForSelector('[data-page="dashboard"]');
  },
  10
);

if (report.isLeaking) {
  console.error(`內存泄漏檢測到！每次操作增長 ${(report.growthRate / 1024).toFixed(1)} KB`);
  console.error(`基線: ${(report.baselineHeap / 1024 / 1024).toFixed(2)} MB → 最終: ${(report.finalHeap / 1024 / 1024).toFixed(2)} MB`);
  process.exit(1);
} else {
  console.log('內存穩定，未檢測到泄漏');
}
```

### 集成到 CI/CD

```yaml
# .github/workflows/memory-check.yml
name: Memory Leak Check
on: [pull_request]

jobs:
  memory-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npx http-server dist -p 3000 &
      - run: npx tsx tests/memory/dashboard-leak-test.ts
      - run: npx tsx tests/memory/router-leak-test.ts
```

## 內存監控的生產環境實踐

開發環境的檢測不足以覆蓋所有場景。生產環境需要持續監控用戶側的內存狀態：

```typescript
// 生產環境內存監控
class MemoryMonitor {
  private threshold = 0.8; // 80% 堆限制
  private intervalId: number | null = null;

  start() {
    // 每 30 秒採樣一次
    this.intervalId = window.setInterval(() => {
      this.checkAndReport();
    }, 30000);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  private checkAndReport() {
    if (!performance.memory) return; // 非 Chromium 瀏覽器

    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
    const usage = usedJSHeapSize / jsHeapSizeLimit;

    if (usage > this.threshold) {
      this.reportMemoryPressure(usage, usedJSHeapSize);
    }
  }

  private reportMemoryPressure(usage: number, heapSize: number) {
    // 上報到監控平臺
    navigator.sendBeacon('/api/metrics/memory', JSON.stringify({
      type: 'memory_pressure',
      usage: usage.toFixed(4),
      heapSizeMB: (heapSize / 1024 / 1024).toFixed(2),
      url: location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    }));
  }
}

// 頁面可見性變化時暫停/恢復監控
const monitor = new MemoryMonitor();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    monitor.stop();
  } else {
    monitor.start();
  }
});
monitor.start();
```

### Performance Observer 監控內存

```typescript
// 監控 long task，間接反映內存壓力
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 100) {
      // Long task > 100ms，可能是 GC 暫停
      reportMetric('long_task', {
        duration: entry.duration,
        startTime: entry.startTime,
      });
    }
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

## 小結

前端內存泄漏不是單一問題，而是一類問題的集合——閉包、事件監聽器、定時器、DOM 引用、全局變量，每種都有特定的檢測和修複方法。Chrome DevTools 的 Heap Snapshot 三點對比法是定位泄漏的黃金標準，但手動操作難以持續，Puppeteer 自動化方案才能融入 CI 流程。

WeakMap 和 WeakRef 提供了不阻止 GC 的引用方式，是緩存和對象關聯場景的正確工具。但要記住，弱引用不是銀彈——它增加代碼複雜度，且 GC 時機不可控，只在確實需要時使用。

生產環境的內存監控是最後一道防線。通過 `performance.memory` API 持續採樣用戶側的堆使用率，在內存壓力達到閾值時及時告警，可以在用戶感知到卡頓之前發現問題。

內存管理是前端工程成熟度的標誌。一個在意用戶體驗的團隊，不應該等到 OOM 崩潰才開始關注內存。
