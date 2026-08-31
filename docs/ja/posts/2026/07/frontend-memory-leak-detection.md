---
title: "フロントエンドメモリリーク診断と防御体系：Chrome DevTools から自動検出まで"
date: 2026-07-22 16:00:49
tags:
  - パフォーマンス最適化
readingTime: 10
description: "フロントエンドメモリリークの一般的なパターン、Chrome DevTools の診断方法、弱参照の正しい使い方、Puppeteer ベースの自動メモリリーク検出方案を体系的に整理する。"
wordCount: 1964
---

フロントエンドのメモリリークは「茹でガエル」のような問題である。開発段階では数 MB のリークはほぼ感知されないが、アプリケーションが長時間稼働するとページが徐々に重くなり、クラッシュし、ユーザーの離脱がすでに発生している。SPA の普及とフロントエンドアプリケーションの複雑化に伴い、メモリ管理は「オプションの最適化」から「必須の能力」へと変化した。

## フロントエンドメモリリークの一般的なパターン

### 1. クロージャ参照

クロージャは JavaScript の中核機能だが、メモリリークの起こりやすい箇所でもある。よくある罠はクロージャが意図せず大きなオブジェクトを捕捉することである：

```javascript
// リークパターン：クロージャが意図せず大きなオブジェクトを保持
function createHandler() {
  const hugeData = new Array(100000).fill({ name: 'data', value: Math.random() });

  return function handleClick() {
    // 1 行のデータしか使わないが、hugeData 全体がクロージャに保持される
    console.log(hugeData[0].name);
  };
}

const handler = createHandler();
document.getElementById('btn').addEventListener('click', handler);
// hugeData[0] しか必要ないのに、配列全体が GC されない
```

修正方法——クロージャが捕捉する範囲を精密に制御する：

```javascript
function createHandler() {
  const hugeData = new Array(100000).fill({ name: 'data', value: Math.random() });
  const firstName = hugeData[0].name; // 必要な値だけ抽出

  return function handleClick() {
    console.log(firstName);
  };
  // hugeData は createHandler のリターン後に GC 可能
}
```

### 2. イベントリスナーの未削除

最も古典的なリークパターンである。イベントリスナーを追加したが削除を忘れた、または削除時に異なる関数を参照した場合：

```javascript
// リークパターン：無名関数は削除できない
function setupListener(element) {
  element.addEventListener('click', () => {
    console.log('clicked');
  });
  // 無名関数に参照がないため removeEventListener 不可
}

// リークパターン：削除する関数の参照が異なる
function setupListener(element) {
  this.handle = () => { console.log('clicked'); };
  element.addEventListener('click', this.handle);
}
function cleanup(element) {
  // エラー！bind は毎回新しい関数を作成し、addEventListener の参照と異なる
  element.removeEventListener('click', this.handle.bind(this));
}

// 正しいやり方
function setupListener(element) {
  this.handle = () => { console.log('clicked'); };
  element.addEventListener('click', this.handle);
}
function cleanup(element) {
  element.removeEventListener('click', this.handle); // 同一参照
}
```

### 3. タイマーの未クリア

```javascript
// リークパターン：setInterval が永遠にクリアされない
function startPolling() {
  setInterval(() => {
    fetch('/api/status').then(res => res.json()).then(data => {
      this.updateUI(data); // コンポーネントインスタンスの参照を保持
    });
  }, 5000);
}

// 正しいやり方
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

### 4. DOM 参照

JavaScript で DOM 要素の参照を保持していると、要素がドキュメントから削除されても GC されない：

```javascript
// リークパターン：変数が削除済みの DOM 要素を保持
const buttons = [];
function addButton() {
  const btn = document.createElement('button');
  document.body.appendChild(btn);
  buttons.push(btn); // 参照を保持
}

function removeButtons() {
  buttons.forEach(btn => btn.remove());
  // DOM 要素はドキュメントから削除されたが、buttons 配列がまだ参照を保持 → リーク
  buttons.length = 0; // 修正：参照をクリア
}
```

### 5. グローバル変数

```javascript
// リークパターン：意図せずグローバル変数を作成
function processData() {
  cache = {}; // let/const/var なし、window にマウント
  for (let i = 0; i < 10000; i++) {
    cache[i] = { data: new ArrayBuffer(1024) };
  }
}
// cache は永遠に回収されない
```

## Chrome DevTools Memory パネル

### Heap Snapshot の三つのビュー

Chrome DevTools の Memory パネルは三つのヒープスナップショットビューを提供する：

- **Summary**：コンストラクタ別にグループ化、オブジェクト数とメモリ使用量を表示
- **Comparison**：二つのスナップショット間の差分を比較し、増分オブジェクトを特定
- **Containment**：GC ルートからの参照チェーン、オブジェクトがなぜ回収されないかを分析

### 三スナップショット比較法

これはメモリリークを特定する最も効果的な方法である：

1. **最初のスナップショット**（Snapshot 1）：操作前のベースライン
2. **操作の実行**：例えばルート切り替え、モーダルの開閉
3. **二番目のスナップショット**（Snapshot 2）：操作後の状態
4. **操作の繰り返し**：同じ操作を再度実行
5. **三番目のスナップショット**（Snapshot 3）
6. **Snapshot 1 と Snapshot 3 を比較**：同じ操作後にメモリが持続的に増加している場合、リークが存在する

Comparison ビューで `# Delta` 列に注目する——正の数は新規オブジェクト数を示す。ある種類のオブジェクトの `# Delta` が操作の繰り返し後に持続的に増加している場合、それがリークの候補である。

### Allocation Timeline

Allocation Timeline モードはメモリ割り当て状況をリアルタイムで記録できる：

```javascript
// DevTools コンソールでタイミングをマーク
console.log('操作開始');
// ... 操作を実行 ...
console.mark('操作完了');
```

タイムライン上で各メモリ割り当てのピークを確認できる。割り当て後のメモリが操作前のレベルに戻らない場合、回収されなかったオブジェクトが存在する。

## 弱参照の正しい使用

### WeakMap：オブジェクト関連付けに適したツール

オブジェクトに追加データを付与したいが、そのオブジェクトの GC を阻止したくない場合、WeakMap が正しい選択である：

```javascript
// リークパターン：Map で DOM 要素のデータをキャッシュ
const elementData = new Map();

function cacheData(element, data) {
  elementData.set(element, data);
}
// element が DOM から削除されても、Map が参照を保持 → リーク

// 正しいやり方：WeakMap は key の GC を阻止しない
const elementData = new WeakMap();

function cacheData(element, data) {
  elementData.set(element, data);
}
// element が GC される時、WeakMap の対応するエントリも自動的に消滅
```

### WeakRef：弱参照の保持

`WeakRef` はオブジェクトの弱参照を保持でき、そのオブジェクトのガベージコレクションを阻止しない。キャッシュのケースに適する：

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

// 使用例：大きなオブジェクトをキャッシュし、メモリが逼迫した時に自動解放
const cache = new WeakCache();
const getData = (id: string) => cache.get(id, () => fetchHugeData(id));
```

### FinalizationRegistry：オブジェクト回収通知

WeakRef と組み合わせて、オブジェクトが GC された時にクリーンアップロジックを実行できる：

```javascript
const registry = new FinalizationRegistry((heldValue: string) => {
  console.log(`オブジェクト ${heldValue} はガベージコレクションされました`);
  // クリーンアップロジックの実行、例: WebSocket のクローズ、WebGL リソースの解放
});

class ResourceManager {
  private resource: any;

  constructor(id: string) {
    this.resource = createResource();
    registry.register(this, id, this.resource);
    // 第三引数は unregister token
  }

  dispose() {
    registry.unregister(this.resource);
    this.resource.close();
    this.resource = null;
  }
}
```

注意：FinalizationRegistry のコールバックは非同期であり、タイムリーな実行は保証されない。重要なリソース解放をこれに依存してはならない。デバッグやオプションのクリーンアップに適する。

## SPA のルート切り替え時のメモリ管理

SPA のルート切り替えはメモリリークの起こりやすい箇所である。毎回のルート切り替えで旧ページのコンポーネントがアンマウントされるが、クリーンアップが不完全だとコンポーネントインスタンスと関連リソースが蓄積し続ける。

```typescript
// React ルート切り替えの汎用クリーンアップパターン
function usePageData(pageId: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // 前回のデータをクリアし、メモリを解放
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
      controller.abort(); // 未完了のリクエストを中止
    };
  }, [pageId]);

  return data;
}
```

### Vue コンポーネントのアンマウントクリーンアップ

```typescript
// Vue 3 Composition API のクリーンアップパターン
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
    // 重要：observer を切断し、DOM への参照を解放
    observer?.disconnect();
    observer = null;
  });

  return { width, height };
}
```

### React コンポーネントのアンマウントクリーンアップ

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
      // クリーンアップ順序：先にリスナーを削除、それから接続をクローズ
      ws.removeEventListener('message', handleMessage);
      ws.close();
    };
  }, [url]);

  return messages;
}
```

## 自動メモリリーク検出：Puppeteer + スナップショット比較

DevTools での手動メモリリーク確認は効率が低く、継続するのが難しい。以下は Puppeteer ベースの自動検出手法である：

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
  // --expose-gc フラグで Chrome を起動する必要あり
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

    // ウォームアップ：一度操作を実行し、キャッシュなどを初期化
    await action(page);
    await forceGC(page);

    // ベースラインスナップショット
    const baseline = await getMemoryUsage(page);

    const snapshots: MemorySnapshot[] = [baseline];

    // 操作を繰り返し実行し、メモリ増加傾向を検出
    for (let i = 0; i < iterations; i++) {
      await action(page);
      await forceGC(page);
      await new Promise(resolve => setTimeout(resolve, 500)); // GC 完了を待つ
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
  growthRate: number; // 各操作あたりの平均増加（バイト）
  snapshots: MemorySnapshot[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

function analyzeSnapshots(snapshots: MemorySnapshot[]): MemoryLeakReport {
  const heapSizes = snapshots.map(s => s.usedJSHeapSize);
  const baseline = heapSizes[0];
  const final = heapSizes[heapSizes.length - 1];

  // 線形回帰の傾きを計算し、増加傾向を判定
  const n = heapSizes.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = heapSizes.reduce((a, b) => a + b, 0);
  const sumXY = heapSizes.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = heapSizes.reduce((sum, _, x) => sum + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  const growthRate = slope;
  const isLeaking = growthRate > 50000; // 閾値：各操作あたり 50KB 超の増加

  return {
    isLeaking,
    baselineHeap: baseline,
    finalHeap: final,
    growthRate,
    snapshots,
    trend: slope > 50000 ? 'increasing' : slope < -10000 ? 'decreasing' : 'stable',
  };
}

// 使用例
const report = await detectMemoryLeak(
  'http://localhost:3000/dashboard',
  async (page) => {
    // ルート切り替えをシミュレート：詳細ページに入って戻る
    await page.click('[data-nav="detail"]');
    await page.waitForSelector('[data-page="detail"]');
    await page.click('[data-nav="back"]');
    await page.waitForSelector('[data-page="dashboard"]');
  },
  10
);

if (report.isLeaking) {
  console.error(`メモリリークを検出！各操作あたり ${(report.growthRate / 1024).toFixed(1)} KB 増加`);
  console.error(`ベースライン: ${(report.baselineHeap / 1024 / 1024).toFixed(2)} MB → 最終: ${(report.finalHeap / 1024 / 1024).toFixed(2)} MB`);
  process.exit(1);
} else {
  console.log('メモリは安定、リークは検出されません');
}
```

### CI/CD への統合

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

## メモリモニタリングの本番環境プラクティス

開発環境での検出だけではすべてのケースをカバーできない。本番環境ではユーザー側のメモリ状態を継続的にモニタリングする必要がある：

```typescript
// 本番環境のメモリモニタリング
class MemoryMonitor {
  private threshold = 0.8; // ヒープ制限の 80%
  private intervalId: number | null = null;

  start() {
    // 30 秒ごとにサンプリング
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
    if (!performance.memory) return; // 非 Chromium ブラウザ

    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
    const usage = usedJSHeapSize / jsHeapSizeLimit;

    if (usage > this.threshold) {
      this.reportMemoryPressure(usage, usedJSHeapSize);
    }
  }

  private reportMemoryPressure(usage: number, heapSize: number) {
    // モニタリングプラットフォームに報告
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

// ページ可視性変化時にモニタリングを一時停止/再開
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

### Performance Observer でメモリをモニタリング

```typescript
// long task をモニタリングし、間接的にメモリプレッシャーを反映
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 100) {
      // 100ms 超の Long task、GC 一時停止の可能性
      reportMetric('long_task', {
        duration: entry.duration,
        startTime: entry.startTime,
      });
    }
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

## まとめ

フロントエンドのメモリリークは単一の問題ではなく、一連の問題の集合である——クロージャ、イベントリスナー、タイマー、DOM 参照、グローバル変数、それぞれに固有の検出と修正方法がある。Chrome DevTools の Heap Snapshot 三スナップショット比較法はリーク特定のゴールドスタンダードだが、手動操作は継続が困難であり、Puppeteer による自動化でようやく CI プロセスに組み込める。

WeakMap と WeakRef は GC を阻止しない参照方法を提供し、キャッシュやオブジェクト関連付けのケースに適したツールである。ただし弱参照は銀の弾丸ではない——コードの複雑さが増し、GC のタイミングは制御不可能であるため、真に必要な場合にのみ使用すべきである。

本番環境のメモリモニタリングは最後の防衛線である。`performance.memory` API でユーザー側のヒープ使用率を継続的にサンプリングし、メモリプレッシャーが閾値に達した時にタイムリーにアラートを出すことで、ユーザーが遅延を感知する前に問題を発見できる。

メモリ管理はフロントエンドエンジニアリングの成熟度の指標である。ユーザー体験を重視するチームは、OOM クラッシュが起きてからメモリに関心を持つべきではない。
