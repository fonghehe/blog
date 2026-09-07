---
title: "React Native 長清單卡頓排查：先測再調 FlatList"
date: 2026-09-07 19:14:42
tags:
  - 移動端
description: "從生產構建、JS 執行緒與清單佈局入手定位 RN FlatList 的滾動卡頓。"
readingTime: 3
wordCount: 810
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

## 從一次真實的卡頓開始

假設商品列表滑到第 80 行時明顯掉幀。先用發佈構建在同一台設備、同一份數據上復現，記錄滾動方向、行數、圖片尺寸和掉幀區間；開發模式的額外開銷會干擾判斷。然後分開看 JS 線程和 UI 線程：JS 忙於格式化價格、處理狀態更新時，觸摸反饋可能遲滯；UI 線程忙於圖片解碼或複雜繪制時，即使 JS 很空閒也會卡。不要一上來調 `windowSize`，否則可能只是把卡頓換成白塊。

固定高度的行可提供 `getItemLayout`，但有換行標題、動態字體或展開區域的行不能偽造固定高度，否則 `scrollToIndex` 會定位錯誤。圖片需按顯示尺寸加載並緩存；列表項只接收渲染所需的穩定字段。若 `renderItem` 閉包每次都變化，或者父組件把全局 store 的每次變動傳給整張列表，即使包了 `memo` 也可能持續重渲染。

```tsx
const Row = memo(function Row({ item, onOpen }: RowProps) {
  return <Pressable onPress={() => onOpen(item.id)}><Text>{item.title}</Text></Pressable>;
});
// 數據、keyExtractor、onOpen 的穩定性也要一起檢查，不能只給 Row 加 memo。
```

## 每次只驗證一個假設

先記錄基線的幀時間、首屏時間、內存峰值和空白行數量。若懷疑渲染範圍過大，只改變一個虛擬化參數，重復相同的滑動路線；若懷疑狀態扇出，給行組件加渲染計數並模擬收藏一件商品，確認只有受影響的行更新。最後在低端設備上復測快速滑動、返回列表位置、字體放大與圖片加載失敗。優化後如果幀率提高但出現白塊或焦點丟失，這不是完成。

參考：[React Native 性能指南](https://reactnative.dev/docs/performance)。
