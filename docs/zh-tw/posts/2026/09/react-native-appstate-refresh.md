---
title: "React Native 前景與背景切換：讓清單恢復後拿到可信資料"
date: 2026-09-01 19:08:53
tags:
  - 移動端
description: "用 AppState、請求世代和伺服器端版本處理 React Native 頁面恢復，避免舊請求覆蓋新資料。"
readingTime: 1
wordCount: 363
---

行動應用從背景回來時，記憶體中的頁面可能還在，但訂單、報價和登入狀態早已變化。最常見的錯誤是每次 `active` 都無條件重新擷取資料：快速切換應用會觸發並行請求，後回傳的舊請求還可能蓋掉新資料。

## 先定義何時更新

記錄最近一次成功同步時間與當前使用者標識。只在應用從非活躍狀態回到 `active`、資料超過業務允許的陳舊視窗時更新。登入帳戶改變必須清掉舊帳戶快取，不能只依靠時間視窗。網路恢復可以觸發同一套更新入口，但不應假設「已聯網」就代表介面可用。

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
        if (request === generation.current) console.warn('更新失敗', error);
      });
    });
    return () => { generation.current++; subscription.remove(); };
  }, [refresh]);
}
```

這個 Hook 只負責恢復事件。請求層仍需用 `AbortController` 或請求世代阻止舊響應寫入快取；展示清單前還要按伺服器端版本或更新時間驗證。否則「請求發起順序」無法保證「資料新舊順序」。

## 驗收場景

- 切到背景超過更新視窗再回傳，只產生一次有效更新；短暫切換不閃動。
- A 帳戶的請求未結束就切到 B 帳戶，A 的響應不會進入 B 的快取。
- 斷網回傳顯示最後可信快照及更新時間，恢復網路後可手動重試。

參考：[React Native AppState](https://reactnative.dev/docs/appstate)。
