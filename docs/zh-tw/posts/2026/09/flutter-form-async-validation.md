---
title: "Flutter 表單非同步驗證：防止舊結果覆蓋新輸入"
date: 2026-09-18 10:25:57
tags:
  - 移動端
description: "處理 Flutter 表單的防抖、請求世代、提交鎖定和伺服器端錯誤回填。"
readingTime: 3
wordCount: 761
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

## 用戶改了輸入，舊結果就失去資格

以註冊表單的用戶名檢查為例：用戶先輸入 `alice`，請求 A 尚未返回時又改成 `alice2` 併發出請求 B。即使 A 後返回“已佔用”，也不能把錯誤標在 `alice2` 上。每個異步校驗保存發起時的字段值與序號，響應回來後先比較當前值和最新序號。取消 HTTP 請求可以省流量，但是否更新 UI 仍要靠這個檢查，因為取消與響應可能同時發生。

把本地同步規則（必填、長度、格式）放在輸入時即可執行的路徑；需要服務器知識的檢查（用戶名可用、優惠碼有效）只在停止輸入一小段時間後發起。頁面離開時釋放監聽和定時器。提交時不要信賴幾秒前的“可用”提示，服務端仍需原子地校驗唯一性。提交結果按字段映射錯誤，保留用戶已填內容；網絡錯誤顯示為表單級問題，不應偽裝成某個字段不合法。

```dart
final valueAtStart = controller.text;
final ticket = ++latestValidation;
final available = await api.isUsernameAvailable(valueAtStart);
if (!mounted || ticket != latestValidation || controller.text != valueAtStart) return;
setState(() => usernameError = available ? null : 'Name is taken');
```

## 驗證完整的表單生命週期

測試快速輸入、刪除後重輸同一值、慢響應逆序、旋轉屏幕、離開頁面後響應、提交期間斷網與重復點擊。特別檢查提交成功後的導航只能發生一次，失敗後按鈕恢復可用。若頁面使用狀態管理器而非 `StatefulWidget`，把 `mounted` 換成相應的生命週期檢查；關鍵條件仍是“結果屬於當前字段值與當前請求”。
