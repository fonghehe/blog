---
title: "React Native 長清單卡頓排查：先測再調 FlatList"
date: 2026-09-07 19:14:42
tags:
  - 移動端
description: "從生產構建、JS 執行緒與清單佈局入手定位 RN FlatList 的滾動卡頓。"
readingTime: 1
wordCount: 382
---

長清單卡頓不一定是 `FlatList` 的視窗參數太小。行元件做了昂貴計算、圖片解碼佔用主執行緒、滾動時觸發全頁狀態更新，都可能表現為掉影格。先在接近正式發佈的構建里復現，再決定改哪一層。

## 先分清瓶頸

記錄裝置、資料量、圖片尺寸和出現卡頓的操作。比較 JS 執行緒與 UI 執行緒的影格率：若 JS 忙於格式化或重複渲染，優先縮小行元件依賴；若滾動時主執行緒持續繁忙，檢查圖片、佈局和原生視圖。調試模式的性能不能代表發佈包。

## 只針對已確認的問題調參

固定高度行可提供 `getItemLayout`，免去每次滾動目標定位的測量；行 ID 用穩定業務鍵，不用數組下標。分頁應在請求進行中去重，並在篩選條件變化時丟棄上一查詢的響應。`windowSize`、批量渲染數量需要在低端實機上測記憶體和空白區域，不能只追求一個更大的數字。

```tsx
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
  onEndReached={loadNextPage}
/>
```

上面的 `getItemLayout` 僅適用於高度確實固定的行；動態文字、系統字體放大和多語言換行會破壞這個前提。驗收要覆蓋首次載入、快速滑到底部、切篩選條件、圖片未快取和字體放大，而不只是空資料下的滾動演示。

參考：[React Native 性能指南](https://reactnative.dev/docs/performance)。
