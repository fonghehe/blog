---
title: "React Native 前後台切換：讓列表恢復後拿到可信數據"
date: 2026-09-01 19:08:53
tags:
  - 移動端
description: "用 AppState、請求代次和伺服器版本處理 React Native 頁面恢復，避免舊請求覆蓋新數據。"
readingTime: 1
wordCount: 357
---

移動應用從後台回來時，記憶體中的頁面可能還在，但訂單、報價和登入狀態早已變化。最常見的錯誤是每次 `active` 都無條件重拉：快速切換應用會觸發並行請求，後返回的舊請求還可能蓋掉新數據。

## 先定義何時刷新

記錄最近一次成功同步時間與當前用戶標識。只在應用從非活躍狀態回到 `active`、數據超過業務允許的陳舊窗口時刷新。登入賬戶改變必須清掉舊賬戶緩存，不能只依靠時間窗口。網絡恢復可以觸發同一套刷新入口，但不應假設「已聯網」就代表介面可用。

```tsx
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';

export function useResumeRefresh(refresh: () => Promise<void>) {
  const previous = useRef<AppStateStatus>(AppState.currentState);
  const generation = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      const resumed = previous.current !== 'active' && next === 'active';
      previous.current = next;
      if (!resumed) return;
      const request = ++generation.current;
      void refresh().catch(error => {
        if (request === generation.current) console.warn('刷新失敗', error);
      });
    });
    return () => { generation.current++; subscription.remove(); };
  }, [refresh]);
}
```

這個 Hook 只負責恢復事件。請求層仍需用 `AbortController` 或請求代次阻止舊響應寫入緩存；展示列表前還要按伺服器版本或更新時間校驗。否則「請求發起順序」無法保證「數據新舊順序」。

## 驗收場景

- 切到後台超過刷新窗口再返回，只產生一次有效刷新；短暫切換不閃動。
- A 賬戶的請求未結束就切到 B 賬戶，A 的響應不會進入 B 的緩存。
- 斷網返回顯示最後可信快照及更新時間，恢復網絡後可手動重試。

參考：[React Native AppState](https://reactnative.dev/docs/appstate)。
