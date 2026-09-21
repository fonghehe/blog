---
title: "React Native 原生能力接入：模組邊界和失敗語義怎麼定"
date: 2026-09-21 17:46:21
tags:
  - 移動端
description: "從掃描與生物識別案例設計 RN 原生模組的介面、權限、取消和錯誤語義。"
readingTime: 3
wordCount: 819
---

RN 頁面要調用掃描、藍牙或生物識別時，難點並不只是把一個方法暴露給 JavaScript。原生權限彈窗、應用退到後台、設備不支援、用戶主動取消，這些狀態都要進入業務流程，否則頁面只會看到一個含糊的 Promise rejection。

## 介面先說清楚結果

把結果分成 `success`、`cancelled`、`permissionDenied`、`unavailable` 與 `failed`。取消不是異常；權限拒絕也不應被吞成「掃描失敗」。模組只返回掃描文字等原始結果，業務層負責查詢訂單、校驗權限和展示內容，避免原生實現與後端業務模型耦合。

一次掃描只允許一個活躍調用。若頁面離開或應用進入後台，結束原生會話並釋放攝像頭；重複點擊返回「正在進行中」或聚合到同一次調用。事件訂閱必須在卸載時解除，防止回到頁面後收到兩份結果。

## 用真實設備驗證契約

模擬器可以驗證 JS 的分支，但不能代替真機權限、攝像頭和系統彈窗測試。至少檢查首次授權、永久拒絕、系統設置中撤回權限、掃描期間切後台、快速重複點擊，以及 iOS / Android 錯誤碼映射。原生介面變更還需要與安裝包版本兼容，不能假設一次 JS 更新就能更新本機原生代碼。

## 以掃碼能力為例定義邊界

業務頁面需要“掃描二維碼並得到文本”，卻不應知道 Android 權限回調、iOS 相機中斷和原生庫的內部事件。先把 JS 可見契約縮小成 `scan(options): Promise<ScanResult>`，結果包含規範化文本和來源，錯誤用穩定代碼表達取消、無權限、設備不可用。權限彈窗的時機由業務流程決定，但權限狀態和設備資源的最終事實來自原生平台。不要把原生異常字符串直接透傳給用戶界面，它們隨平台和系統版本變化。

一次掃描可能跨越頁面離開、App 進入後台、React Native 實例銷毀。原生側必須保證每次調用恰好完成或取消一次，關閉相機、取消監聽，並拒絕第二個併發掃描或明確排隊。JS 側也要把結果與當前頁面實例關聯；舊頁面的 Promise 返回後不能導航新頁面。對於較大的二進製圖像，傳文件句柄或受控路徑比把 base64 反復穿過 JS 邊界更合適，同時要定義臨時文件的清理責任。

```ts
type ScanResult = { text: string; source: 'camera' | 'image' };
type ScanErrorCode = 'CANCELLED' | 'PERMISSION_DENIED' | 'UNAVAILABLE';
interface Scanner { scan(options: { formats: string[] }): Promise<ScanResult> }
```

## 用契約測試隔離平台差異

在 JS 測試中模擬成功、取消、拒絕權限、頁面離開和重復點擊；在原生集成測試中確認資源釋放、前後台切換、權限被系統撤銷。分別在 iOS 和 Android 設備上做一次真實掃描，檢查相同二維碼返回的規範化結果。接入新架構或替換原生庫時，只要業務契約不變，頁面無需一起改寫。參考：[React Native 原生模塊生命週期](https://reactnative.dev/docs/the-new-architecture/native-modules-lifecycle)。

參考：[React Native Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。
