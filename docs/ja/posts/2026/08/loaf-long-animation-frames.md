---
title: "Long Animation Frame API 実践：帰属の盲点から INP 精密最適化へ"
date: 2026-08-14 15:23:41
tags:
  - パフォーマンス最適化
readingTime: 10
description: "PerformanceObserver long-animation-frame（LoAF）API は Long Task API の帰因不能という核心的な欠陥を解決する。本記事では LoAF のフィールドの意味、本番環境での収集方法を解説し、サードパーティスクリプトのブロッキング、長いレンダリングパス、スタイル・レイアウトスラッシングの 3 つの実例を通じて、LoAF を活用した INP 最適化の方法を示す。"
wordCount: 2198
---

INP（Interaction to Next Paint）が 2024 年に FID に代わって Core Web Vitals 指標となった後、フロントエンドチームは気まずい現実に直面している：ページの応答が遅いことは分かっているが、何を原因とするのかが分からないのだ。Long Task API は「300ms のロングタスクがある」ことを教えてくれるが、その 300ms の間に一体どんなコードが実行されていたのかは教えてくれない。この帰属の盲点は 2026 年に Long Animation Frame API（LoAF）によって埋められた。

## Long Task API ではなぜ不十分なのか

Long Task API は Chrome 58 から利用可能であり、パフォーマンスモニタリングの基盤の一つである。その核心的な問題はただ一つ：**帰属能力がない**ことだ。

```javascript
// Long Task API が提供する情報のすべて
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.duration);      // 320ms
    console.log(entry.startTime);     // 1234.56
    console.log(entry.attribution);   // undefined — 帰属情報なし
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

「何かが 320ms 詰まった」ことが分かった。それで？どのスクリプトか？レンダリングかスクリプト実行か？スタイル計算かレイアウトか？これらの情報はすべて欠落している。実際のプロジェクトでは、一つのページのメインスレッドで自社コード、サードパーティ SDK、広告スクリプト、分析ツールが同時に動作している可能性があるが、Long Task API はそれらを区別できない。

これが普遍的なジレンマを生んでいる：INP スコアが悪く、DevTools でロングバーが見えるのに、本番環境で責任者を体系的に特定・追跡できないのだ。

## LoAF の主要フィールド

LoAF は `PerformanceObserver` の `long-animation-frame` タイプを通じて公開され、各エントリは 1 フレーム内で 50ms を超えるアニメーションフレームサイクルを表す。Long Task よりも 4 つの重要な次元を追加で提供する：

```typescript
interface PerformanceLongAnimationFrameEntry extends PerformanceEntry {
  // フレーム内の全スクリプト実行の帰属リスト
  scripts: PerformanceScriptTiming[];

  // レンダリング開始時刻（navigationStart からの相対値）
  renderStart: number;

  // スタイル・レイアウト計算の開始時刻
  styleAndLayoutStart: number;

  // フレーム内最初のユーザー入力イベントのタイムスタンプ（インタラクションとの関連付け用）
  firstUIEventTimestamp: number;

  // ブロッキング持続時間（並列作業を除いた純粋なブロッキング時間）
  blockingDuration: number;
}

interface PerformanceScriptTiming {
  name: string;              // スクリプト URL または 'unknown'
  entryType: 'script';
  startTime: number;
  duration: number;
  invoker: string;           // 呼び出し元識別子（例：'onclick', 'setTimeout'）
  invokerType: string;       // 'event-listener' | 'resolve-promise' | 'classic-script' | 'module-script' など
  windowAttribution: string; // 'self' | 'descendant' | 'ancestor' | 'same-page' | 'other'
  sourceURL: string;         // スクリプトソース URL
  sourceFunctionName: string;// 関数名（取得可能な場合）
  sourceCharPosition: number;// ソースコード内の文字位置
}
```

これらのフィールドの組み合わせにより帰属が可能になる。具体的な例を挙げる：

```javascript
const loafObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration < 100) continue; // 100ms 以上のフレームのみ注目

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

`renderStart` に値があり `scripts` が空の場合、そのフレームの時間は主にレンダリングフェーズ（スタイル/レイアウト/ペイント）に費やされており、スクリプト実行ではないことを示す。これは Long Task API では全く区別できなかったシナリオである。

## 本番環境での収集スキーム

LoAF のデータ量は Long Task よりもはるかに大きい（1 フレームに複数の script エントリが含まれる可能性がある）。全量をそのまま送信するとデータが爆発する。本番環境ではサンプリングとバッファリング戦略が必要だ。

### サンプリング + バッファリング + sendBeacon

```typescript
class LoAFCollector {
  private buffer: object[] = [];
  private sampleRate: number;
  private maxBufferSize: number;
  private flushInterval: number;
  private timerId: number | null = null;

  constructor(options: { sampleRate?: number; maxBufferSize?: number; flushIntervalMs?: number } = {}) {
    this.sampleRate = options.sampleRate ?? 0.1; // デフォルト 10% サンプリング
    this.maxBufferSize = options.maxBufferSize ?? 20;
    this.flushInterval = options.flushIntervalMs ?? 10000;
  }

  start() {
    if (!('PerformanceObserver' in window)) return;

    // ブラウザが long-animation-frame をサポートしているか確認
    const supported = PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');
    if (!supported) {
      console.warn('LoAF not supported, falling back to longtask');
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // サンプリングフィルタ
        if (Math.random() > this.sampleRate) continue;

        // 意味のあるロングフレームのみ収集（>100ms）
        if (entry.duration < 100) continue;

        this.buffer.push(this.serialize(entry));

        if (this.buffer.length >= this.maxBufferSize) {
          this.flush();
        }
      }
    });

    // buffered: true は登録前に発生したエントリの取りこぼしを防ぐ
    observer.observe({ type: 'long-animation-frame', buffered: true });

    // 定期的にバッファをフラッシュ
    this.timerId = window.setInterval(() => this.flush(), this.flushInterval);

    // ページアンロード前に強制フラッシュ
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

    // sendBeacon はページアンロード時でも送信を保証する
    const sent = navigator.sendBeacon('/api/metrics/loaf', payload);
    if (!sent) {
      // フォールバック：fetch keepalive
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

// 初期化
const collector = new LoAFCollector({ sampleRate: 0.05, flushIntervalMs: 15000 });
collector.start();
```

`buffered: true` について：このオプションは極めて重要だ。PerformanceObserver は通常 DOM ready 以降に登録されるが、LoAF イベントはページ読み込み中にすでに発生している可能性がある。`buffered: true` を指定することで Observer が登録前のエントリを遡って再送し、ファーストビュー段階のロングフレームの見逃しを防ぐ。

## 実例に基づく診断

### ケース 1：サードパーティスクリプトによるメインスレッドのブロッキング

我々の内部ダッシュボードページの INP p75 が 480ms に達していた。LoAF データは以下を示した：

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

帰属は非常に明確だ：340ms のロングフレームのうち、280ms はサードパーティ分析 SDK の setTimeout コールバックによるもので、自社のクリック処理ロジックはわずか 30ms だった。

修正方法は、サードパーティスクリプトをユーザーの初回インタラクション後に遅延読み込みすることだ：

```typescript
// 非クリティカルなサードパーティスクリプトの遅延読み込み
let analyticsLoaded = false;

function loadAnalyticsOnInteraction() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  const script = document.createElement('script');
  script.src = 'https://analytics.vendor.com/sdk.js';
  script.async = true;
  document.head.appendChild(script);
}

// 初回ユーザーインタラクション時にトリガー
['click', 'keydown', 'pointerdown'].forEach((evt) => {
  document.addEventListener(evt, loadAnalyticsOnInteraction, { once: true, capture: true });
});
```

効果：INP p75 が 480ms から 120ms に低下。

### ケース 2：長いレンダリングパス

別のページでは LoAF が全く異なるパターンを示した：

```json
{
  "d": 220,
  "b": 40,
  "rs": 1580,
  "sl": 1620,
  "s": []
}
```

`scripts` が空で、`renderStart` と `styleAndLayoutStart` に値があり、`blockingDuration` はわずか 40ms。これは 220ms のうち 180ms がレンダリングフェーズ――スタイル計算、レイアウト、ペイント――に費やされたことを示す。

調査の結果、当該ページは複雑な CSS Grid レイアウトを使用しており、200 以上のグリッドアイテムと大量のネストされた `calc()` 式を含んでいた。データ更新のたびにトリガーされる再レンダリングが完全なスタイル再計算を引き起こしていた。

修正の方向性：
- `calc()` を事前計算済みの CSS 変数に置き換える
- グリッドコンテナに `contain: layout style` を追加し、スタイル影響範囲を制限する
- 仮想スクロールで DOM ノード数を削減する

### ケース 3：スタイル・レイアウトスラッシング

3 つ目のケースの特徴は、同一フレーム内で複数のスクリプトとレンダリングフェーズが交互に出現することだ：

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

古典的な読み書き交互パターン：`updateItemHeight` がスタイルを書き込み → `measureItems` がジオメトリプロパティを読み取って強制同期レイアウトをトリガー → 繰り返す。LoAF の `sourceFunctionName` フィールドが 2 つの関数名を直接特定してくれた。

修正方法は読み書きの一括分離である：

```typescript
// 修正前：読み書き交互
items.forEach((item) => {
  item.style.height = calculateHeight(item); // 書き込み
  const rect = item.getBoundingClientRect(); // 読み込み → 強制同期レイアウト
  updateCache(item.id, rect);
});

// 修正後：先に一括読み込み、その後一括書き込み
const measurements = items.map((item) => ({
  id: item.id,
  rect: item.getBoundingClientRect(), // 一括読み込み
}));

items.forEach((item, i) => {
  item.style.height = calculateHeight(item); // 一括書き込み
  updateCache(measurements[i].id, measurements[i].rect);
});
```

## LoAF を INP 改善に結びつける

LoAF の価値は単発の診断だけでなく、継続的なパフォーマンス帰属システムの構築にある。我々は内部でシンプルな集計ダッシュボードを構築した：

1. **スクリプト URL 別集計**：各スクリプトの全 LoAF における累積時間割合を統計し、最大のパフォーマンス寄与者を特定する
2. **invoker タイプ別集計**：event-listener、timer、promise などの異なるトリガーソースを区別し、ユーザーインタラクションによるブロッキングかバックグラウンドタスクの干渉かを判断する
3. **ページパス別集計**：ページごとに LoAF の特徴は異なるため、ページ別に分析することで精密な特定が可能になる
4. **トレンド比較**：LoAF 指標と INP p75 を同一タイムラインに重ね、最適化施策の実際効果を検証する

このシステムにより、「INP が高い → DevTools を開いて手動調査 → 推測して修正」というモードから、「LoAF による自動帰属 → 具体的なスクリプトと関数の特定 → 的を絞った修正 → 効果検証」という閉ループへの転換を実現した。

## 展望

LoAF は現在 Chromium 系ブラウザで安定して利用でき、Firefox と Safari のサポートも進行中である。クロスブラウザ対応が必要な場合は、Long Task API をフォールバックとして併用し、データ収集層で feature detection を行うことを推奨する。

LoAF は INP を自動的に改善するものではないが、「なぜ INP が悪いのか」という問いに答えられる回答をもたらす。フロントエンドアプリケーションがますます複雑化し、サードパーティ依存が増加する時代において、帰属能力そのものがインフラストラクチャである。LoAF をパフォーマンスモニタリングシステムに組み込むことは、闇雲な最適化よりも価値がある。
