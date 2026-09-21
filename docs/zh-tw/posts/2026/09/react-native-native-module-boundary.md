---
title: "React Native 原生功能整合：模組邊界和失敗語義怎麼定"
date: 2026-09-21 17:46:21
tags:
  - 移動端
description: "從掃描與生物識別案例設計 RN 原生模組的介面、權限、取消和錯誤語義。"
readingTime: 1
wordCount: 378
---

RN 頁面要調用掃描、藍牙或生物識別時，難點並不只是把一個方法暴露給 JavaScript。原生權限彈窗、應用退到背景、裝置不支援、使用者主動取消，這些狀態都要進入業務流程，否則頁面只會看到一個含糊的 Promise rejection。

## 介面先說清楚結果

把結果分成 `success`、`cancelled`、`permissionDenied`、`unavailable` 與 `failed`。取消不是異常；權限拒絕也不應被吞成「掃描失敗」。模組只回傳掃描文字等原始結果，業務層負責查詢訂單、驗證權限和展示內容，避免原生實現與後端業務模型耦合。

一次掃描只允許一個活躍調用。若頁面離開或應用進入背景，結束原生會話並釋放攝像頭；重複點擊回傳「正在進行中」或聚合到同一次調用。事件訂閱必須在卸載時解除，防止回到頁面後收到兩份結果。

## 用真實裝置驗證契約

模擬器可以驗證 JS 的分支，但不能代替實機權限、攝像頭和系統彈窗測試。至少檢查首次授權、永久拒絕、系統設定中撤回權限、掃描期間切背景、快速重複點擊，以及 iOS / Android 錯誤碼映射。原生介面變更還需要與安裝包版本兼容，不能假設一次 JS 更新就能更新本機原生程式碼。

參考：[React Native Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。
