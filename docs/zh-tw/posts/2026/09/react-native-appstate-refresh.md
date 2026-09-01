---
title: "React Native 前景與背景切換：讓清單恢復後拿到可信資料"
date: 2026-09-01 19:08:53
tags:
  - 移動端
description: "用 AppState、請求世代和伺服器端版本處理 React Native 頁面恢復，避免舊請求覆蓋新資料。"
readingTime: 3
wordCount: 812
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

## 用訂單列表走一遍復歸流程

假設用戶在列表頁切到支付應用，兩分鐘後返回。此時內存里仍有十條訂單，但其中一筆已在另一台設備取消。界面應先保留上一次**已確認**的快照和“上次同步”時間，再顯示輕量刷新狀態；如果請求失敗，繼續顯示舊快照並提示數據可能過期。只有服務器明確返回空集合，才顯示“暫無訂單”。這樣用戶不會在每次切換應用時看見白屏，也不會把網絡故障當成訂單消失。

把 `AppState` 視作觸發器，而不是數據正確性的來源。示例 Hook 里的 `generation` 只控制日誌，不能阻止 `refresh()` 自己寫入舊數據；真正的世代檢查必須放在數據倉庫的寫入點。請求帶上發起時的 `accountId` 和遞增的 `requestId`，響應提交前同時比較當前賬號和請求編號。賬號切換時先清空賬號作用域的緩存，再使所有舊請求失效。若服務端提供版本號，只有版本不低於當前版本的響應才可以覆蓋快照。

```ts
// 偽代碼：檢查與寫入必須發生在同一條狀態更新路徑上
const ticket = { accountId: session.accountId, requestId: ++latestRequestId };
const result = await api.listOrders(ticket.accountId);
if (ticket.accountId !== session.accountId || ticket.requestId !== latestRequestId) return;
if (result.version < store.version) return;
store.replace({ items: result.items, version: result.version, syncedAt: Date.now() });
```

## 把競態寫成驗收用例

用可控 Promise 製造先發後到的兩個響應，確認較舊的請求不能覆蓋較新的列表；在 A 的請求未完成時切到 B，確認 A 的內容從未進入 B 的緩存。再測試短暫切出後回來、離線復歸、令牌失效和服務端返回真正空列表。記錄刷新觸發原因、請求耗時和丟棄舊響應的次數，才能分辨“復歸沒有觸發”和“觸發後被正確忽略”。

參考：[React Native AppState](https://reactnative.dev/docs/appstate)。
