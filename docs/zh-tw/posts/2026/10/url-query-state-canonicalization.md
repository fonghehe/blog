---
title: "把篩選條件放進 URL：可分享頁面需要一個規範化協議"
date: 2026-10-29 11:01:42
tags:
  - JavaScript
  - 工程化
description: "用解析、規範化和歷史導航設計列表狀態，避免分享鏈接與畫面各自為政。"
readingTime: 4
wordCount: 1194
---

使用者把列錶鏈接發給同事，對方卻看到預設篩選。補上查詢參數之後，返回鍵又一次退一個輸入字符，刷新時還出現兩次請求。URL 狀態不是把對象 JSON 化就結束，它同時承擔外部輸入、分享協議和瀏覽器歷史。

本文以關鍵詞、狀態和頁碼為例，限定這三個欄位為頁面擁有的查詢空間。生產系統若還要保留活動追蹤或其他模塊參數，應先規定各自所有權，不能照搬這裡“忽略未知參數”的策略。

## 解析時校驗，內部只使用一種表示

URL 可以被手改，也可以來自舊版本。頁碼可能是負數、無限大或重複值，狀態可能是未知枚舉。解析器需要定義預設值與重複值規則，而不只是調用 `Number`。示例對狀態取允許集合、去重後排序；單值欄位取首次出現，頁碼限制為 1 到 9999。

關鍵詞裁到 100 個 UTF-16 程式碼單元，是本例明確的協議上限，並非通用可見字符限制。真實產品如需按字素計數，應替換成一致的分段規則。URL 的編碼和重複參數行為見 [WHATWG URL 標準](https://url.spec.whatwg.org/)。

```javascript
export function parseFilters(search) {
  const params = new URLSearchParams(search);
  const allowed = new Set(['open', 'closed']);
  const status = [...new Set(params.getAll('status')
    .filter(value => allowed.has(value)))].sort();
  const rawPage = params.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(rawPage) && Number(rawPage) >= 1
    ? Number(rawPage) : 1;
  return { q: (params.get('q') ?? '').trim().slice(0, 100), status, page };
}

export function serializeFilters(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const status of filters.status) params.append('status', status);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}

export function canonicalSearch(search) {
  return serializeFilters(parseFilters(search));
}
```

序列化函數接收已經規範化的內部模型。外部對象必須先校驗，不能把未知 status 直接傳進去。預設頁碼從 URL 省略，狀態按固定順序寫出，因此多個等價輸入能落到同一個規範形式。測試應保證規範化冪等，以及解析再序列化後業務含義不變。

## 輸入中的草稿不必每次都進入歷史

搜索框正在輸入的值可以暫存在本地，點擊搜索或達到約定的防抖邊界再提交 URL。正式改變查詢時，根據使用者意圖使用 push；僅清理非法參數或同步同一次操作的中間狀態時，可以 replace。不要把每次鍵盤輸入都變成必須按返回鍵跨過的歷史節點。

如果框架路由已經管理 history，就通過它更新，避免原生 `pushState` 與路由器各做一套。監聽返回和前進時重新解析 URL 並恢復已提交的控件值。切換篩選通常重置頁碼，但恢復歷史應尊重記錄中的頁碼；這兩種事件不能共用一個“任何變化都置第一頁”的副作用。

## 規範化模型也應決定請求身份

UI、資料請求和快取都從同一個已提交模型派生。把規範化結果作為查詢身份，能夠讓 `status=open&status=closed` 與反過來的參數順序共享語義。請求返回時核對當前身份，防止慢響應把新的篩選結果覆蓋掉。

避免控件變化寫 URL，URL 變化又寫控件並再次寫 URL 的循環。可以明確單向路徑：輸入草稿產生使用者動作，動作提交 URL，路由解析產生查詢模型，模型驅動展示和請求。只有規範形式不同時才清理地址，而且一次導航只觸發一次有效載入。

## 分享能力有隱私和有效期邊界

查詢參數會進入歷史、紀錄、複製內容和可能的來源信息。令牌、個人敏感查詢和大段私有條件不適合直接放入鏈接。複雜共享視圖可以保存伺服器端記錄，用受權限保護的短 ID 分享；拿到 ID 不應等於拿到訪問權限。

當枚舉或欄位定義變化時，決定是否保留舊參數遷移。預設值變化也會影響省略欄位的舊鏈接：若分享必須精確復現，可記錄協議版本或顯式寫入關鍵預設值。不要把“鏈接還能打開”當成結果語義沒有改變。

## 從外部打開和歷史恢復兩條路徑驗收

固定測試空查詢、重複參數、非法頁碼、未知枚舉、中文和加號、參數順序變化，以及舊版本鏈接。然後驗證從外部打開、刷新、前進後退和快速連續搜索。斷言控件、URL 和請求條件三者一致，並檢查頁面沒有為規範化重複發起同一請求。

可分享頁面的價值是讓另一個人看到相同的問題現場。把查詢當成小型協議維護，才能在不斷添加篩選項後繼續兌現這個承諾。
