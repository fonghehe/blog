---
title: "Core Web Vitals 2026 新指標與最佳化策略"
date: 2026-06-20 10:23:20
tags:
  - 效能
readingTime: 1
description: "Core Web Vitals 在 2026 年更新了 INP 指標，替代了 FID。本文討論新的評估標準、測量工具和最佳化策略，幫助提升使用者體驗和搜尋排名。"
wordCount: 181
---

Core Web Vitals 是 Google 衡量使用者體驗的核心指標，直接影響搜尋排名。2026 年的指標體系已經穩定，INP（Interaction to Next Paint）正式替代 FID 成為主要的互動回應指標。

## 2026 年的核心指標

| 指標 | 縮寫 | 良好 | 需改善 | 差 |
|------|------|------|--------|-----|
| Largest Contentful Paint | LCP | ≤2.5s | 2.5-4s | >4s |
| Interaction to Next Paint | INP | ≤200ms | 200-500ms | >500ms |
| Cumulative Layout Shift | CLS | ≤0.1 | 0.1-0.25 | >0.25 |

## LCP 最佳化

```html
<!-- 最佳化前 -->
<img src="hero.jpg" />

<!-- 最佳化後 -->
<img src="hero.jpg" 
     fetchpriority="high"
     width="1200"
     height="600"
     alt="Hero image" />
```

## INP 最佳化

INP 測量互動回應時間，包括三個階段：

```javascript
// 1. 輸入延遲（Input Delay）
button.addEventListener('click', () => {
  // 如果這裡執行很慢，輸入延遲會增加
});

// 2. 處理時間（Processing Time）
function handleClick() {
  const result = heavyComputation();
}

// 3. 展示延遲（Presentation Delay）
```

## CLS 最佳化

```css
/* 為圖片和廣告預留空間 */
img, video {
  max-width: 100%;
  height: auto;
  aspect-ratio: 16/9;
}

/* 字體載入不影響佈局 */
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2') format('woff2');
  font-display: swap;
}
```

## 小結

Core Web Vitals 2026 的核心是 LCP、INP 和 CLS。LCP 最佳化關鍵資源載入，INP 最佳化互動回應，CLS 保持佈局穩定。最佳化不是一次性工作，需要持續監控和改進。
