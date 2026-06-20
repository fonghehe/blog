---
title: "Core Web Vitals 2026 新指標與優化策略"
date: 2026-06-20 10:23:20
tags:
  - 性能
readingTime: 1
description: "Core Web Vitals 在 2026 年更新了 INP 指標，替代了 FID。本文討論新的評估標準、測量工具和優化策略，幫助提升用戶體驗和搜索排名。"
wordCount: 174
---

Core Web Vitals 是 Google 衡量用戶體驗的核心指標，直接影響搜索排名。2026 年的指標體系已經穩定，INP（Interaction to Next Paint）正式替代 FID 成為主要的交互響應指標。

## 2026 年的核心指標

| 指標 | 縮寫 | 良好 | 需改進 | 差 |
|------|------|------|--------|-----|
| Largest Contentful Paint | LCP | ≤2.5s | 2.5-4s | >4s |
| Interaction to Next Paint | INP | ≤200ms | 200-500ms | >500ms |
| Cumulative Layout Shift | CLS | ≤0.1 | 0.1-0.25 | >0.25 |

## LCP 優化

```html
<!-- 優化前 -->
<img src="hero.jpg" />

<!-- 優化後 -->
<img src="hero.jpg" 
     fetchpriority="high"
     width="1200"
     height="600"
     alt="Hero image" />
```

## INP 優化

INP 測量交互響應時間，包括三個階段：

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

## CLS 優化

```css
/* 為圖片和廣告預留空間 */
img, video {
  max-width: 100%;
  height: auto;
  aspect-ratio: 16/9;
}

/* 字體加載不影響佈局 */
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2') format('woff2');
  font-display: swap;
}
```

## 總結

Core Web Vitals 2026 的核心是 LCP、INP 和 CLS。LCP 優化關鍵資源加載，INP 優化交互響應，CLS 保持佈局穩定。優化不是一次性工作，需要持續監控和改進。
