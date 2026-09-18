---
title: "Flutter 表單非同步驗證：防止舊結果覆蓋新輸入"
date: 2026-09-18 10:25:57
tags:
  - 移動端
description: "處理 Flutter 表單的防抖、請求世代、提交鎖定和伺服器端錯誤回填。"
readingTime: 1
wordCount: 344
---

註冊、轉賬或修改資料頁面常要非同步檢查使用者名、優惠碼或收款帳戶。使用者輸入 A 後立即改成 B，A 的驗證響應晚到，就可能把 B 標成「不可用」。這不是一個輸入框樣式問題，而是非同步結果歸屬問題。

## 驗證綁定到輸入快照

每次輸入變化遞增世代，並對文字做短暫防抖；請求回傳時同時比較世代和當前文字。不匹配就丟棄結果。提交按鈕不應只看本機正則通過，還要確認必要的非同步驗證已完成；提交時再由伺服器端做最終檢查。

```dart
int generation = 0;

Future<void> validateName(String name) async {
  final current = ++generation;
  final result = await repository.checkName(name);
  if (!mounted || current != generation || controller.text != name) return;
  setState(() => nameError = result.isAvailable ? null : '名稱已被使用');
}
```

這個片段說明結果歸屬，不包含防抖定時器及異常分支；實際實現中還要在頁面銷毀時取消定時器，並把網路錯誤與「名稱不可用」區別顯示。

## 提交是另一條狀態機

提交開始後鎖住重複點擊，給伺服器端請求帶冪等鍵；伺服器端回傳欄位級錯誤時回填到對應輸入框，同時保留其他欄位。失敗後允許修改和重試，成功後只導航一次。測試快慢交錯響應、旋轉屏幕、離開頁面後回傳，以及提交期間斷網。
