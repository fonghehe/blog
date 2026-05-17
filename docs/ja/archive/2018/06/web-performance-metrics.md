---
title: "フロントエンドのパフォーマンス指標：FCP・TTI・FIDとは何か"
date: 2018-06-23 15:02:42
tags:
  - パフォーマンス最適化
readingTime: 3
description: "最近パフォーマンス最適化をしていて、多くの人（自分自身も含めて）がパフォーマンス指標についてあいまいな理解しか持っていないことに気づきました。よく使われる指標の意味をまとめます。"
---

最近パフォーマンス最適化をしていて、多くの人（自分自身も含めて）がパフォーマンス指標についてあいまいな理解しか持っていないことに気づきました。よく使われる指標の意味をまとめます。

## コア指標

### FP（First Paint）初回描画

ブラウザが初めてピクセルをレンダリングした時間。背景色だけかもしれず、ユーザーの知覚は弱い段階です。

### FCP（First Contentful Paint）初回コンテンツ描画

テキスト、画像、SVG、または白以外のcanvasが初めてレンダリングされた時間。ユーザーが初めて「コンテンツがある」と感じる瞬間です。

**目標**：1.8秒未満（Googleの基準）

### LCP（Largest Contentful Paint）最大コンテンツ描画

ビューポート内の最大のテキストまたは画像ブロックのレンダリングが完了した時間。メインコンテンツの読み込み完了を示します。

**目標**：2.5秒未満

### TTI（Time to Interactive）インタラクティブになる時間

ページがユーザー操作に完全に応答できるようになった時間（メインスレッドがアイドル状態で、イベントハンドラーがバインドされている）。

**目標**：3.8秒未満

### FID（First Input Delay）初回入力遅延

ユーザーが最初にページとインタラクション（クリック、入力）してから、ブラウザが実際に処理を始めるまでの遅延時間。

**目標**：100ms未満

### CLS（Cumulative Layout Shift）累積レイアウトシフト

ページ読み込み中の予期しないレイアウトシフトの合計量。サイズ指定のない画像や動的に挿入されるコンテンツが高いCLSを引き起こします。

**目標**：0.1未満

## 測定方法

### Chrome DevTools

```
Performanceパネル → 録画 → Timingsセクションを確認
```

### Lighthouse

```bash
npm install -g lighthouse
lighthouse https://example.com --output html --output-path report.html
```

### Performance API（コード内で測定）

```javascript
// FCPを監視
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-contentful-paint") {
      console.log("FCP:", entry.startTime, "ms");
    }
  }
});
observer.observe({ entryTypes: ["paint"] });

// ナビゲーションタイミングを取得（TTFBなど）
const timing = performance.getEntriesByType("navigation")[0];
console.log("TTFB:", timing.responseStart - timing.fetchStart);
console.log("DOM Ready:", timing.domContentLoadedEventEnd - timing.fetchStart);
console.log("Page Load:", timing.loadEventEnd - timing.fetchStart);
```

## よくある問題と最適化の方向性

| 指標が悪い | 可能な原因                                       | 最適化の方向性                                  |
| ---------- | ------------------------------------------------ | ----------------------------------------------- |
| FCP遅い    | JSがレンダリングをブロック、フォント読み込み遅い | ブロックリソースを削減、重要なCSSをインライン化 |
| LCP遅い    | 大きな画像、サーバーが遅い                       | 画像最適化、CDN、重要な画像をpreload            |
| TTI遅い    | JSが多すぎ、メインスレッドが混雑                 | コード分割、JSの削減                            |
| FID高い    | 長いタスクがメインスレッドをブロック             | 長いタスクを分割、重要でないJSを遅延            |
| CLS高い    | 画像にサイズ指定なし、広告の挿入                 | すべての画像・動画に幅と高さを指定              |

## まとめ

- FCP：ユーザーがコンテンツを見る瞬間（1.8秒未満）
- LCP：メインコンテンツの読み込み完了（2.5秒未満）
- TTI：ページが本当にインタラクティブになる瞬間（3.8秒未満）
- FID：最初のクリックの応答遅延（100ms未満）
- CLS：レイアウトの安定性（0.1未満）
- Lighthouseで定期的にスコアを測定して問題を発見する
