---
title: "Flutter 表單非同步校驗：防止舊結果覆蓋新輸入"
date: 2026-09-18 10:25:57
tags:
  - 移動端
description: "處理 Flutter 表單的防抖、請求代次、提交鎖定和伺服器錯誤回填。"
readingTime: 1
wordCount: 339
---

註冊、轉賬或修改資料頁面常要非同步檢查用戶名、優惠碼或收款賬戶。用戶輸入 A 後立即改成 B，A 的校驗響應晚到，就可能把 B 標成「不可用」。這不是一個輸入框樣式問題，而是非同步結果歸屬問題。

## 校驗綁定到輸入快照

每次輸入變化遞增代次，並對文字做短暫防抖；請求返回時同時比較代次和當前文字。不匹配就丟棄結果。提交按鈕不應只看本地正則通過，還要確認必要的非同步校驗已完成；提交時再由伺服器做最終檢查。

```dart
int generation = 0;

Future<void> validateName(String name) async {
  final current = ++generation;
  final result = await repository.checkName(name);
  if (!mounted || current != generation || controller.text != name) return;
  setState(() => nameError = result.isAvailable ? null : '名稱已被使用');
}
```

這個片段說明結果歸屬，不包含防抖定時器及異常分支；實際實現中還要在頁面銷毀時取消定時器，並把網絡錯誤與「名稱不可用」區別顯示。

## 提交是另一條狀態機

提交開始後鎖住重複點擊，給伺服器請求帶冪等鍵；伺服器返回欄位級錯誤時回填到對應輸入框，同時保留其他欄位。失敗後允許修改和重試，成功後只導航一次。測試快慢交錯響應、旋轉屏幕、離開頁面後返回，以及提交期間斷網。
