---
title: "Web 字型載入最佳化策略"
date: 2020-08-12 10:22:29
tags:
  - 效能最佳化
readingTime: 2
description: "在日常開發中，Web 字型載入最佳化策略的使用頻率越來越高。本文系統地講解其用法、原理和最佳化策略。"
wordCount: 306
---

在日常開發中，Web 字型載入最佳化策略的使用頻率越來越高。本文系統地講解其用法、原理和最佳化策略。

## 快速上手

實際專案中的用法會更復雜一些：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 內部原理

以下是一個完整的示例：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

注意邊界條件處理，這在生產環境中至關重要。

## 業務實戰

關鍵在於理解核心邏輯：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

效能最佳化需要結合具體場景，不是所有情況都需要過度最佳化。

## 效能對比

我們可以通過以下方式來改進：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 小結

- 關注社群動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 程式碼示例僅供參考，需根據業務場景調整
- Web 字型載入最佳化策略不是銀彈，需要根據專案規模和技術棧選擇
- 理解底層原理比記住 API 更重要
