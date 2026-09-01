---
title: "React Native 前后台切换：让列表恢复后拿到可信数据"
date: 2026-09-01 19:08:53
tags:
  - 移动端
description: "用 AppState、请求代次和服务端版本处理 React Native 页面恢复，避免旧请求覆盖新数据。"
readingTime: 1
wordCount: 356
---

移动应用从后台回来时，内存中的页面可能还在，但订单、报价和登录状态早已变化。最常见的错误是每次 `active` 都无条件重拉：快速切换应用会触发并发请求，后返回的旧请求还可能盖掉新数据。

## 先定义何时刷新

记录最近一次成功同步时间与当前用户标识。只在应用从非活跃状态回到 `active`、数据超过业务允许的陈旧窗口时刷新。登录账户改变必须清掉旧账户缓存，不能只依靠时间窗口。网络恢复可以触发同一套刷新入口，但不应假设“已联网”就代表接口可用。

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
        if (request === generation.current) console.warn('刷新失败', error);
      });
    });
    return () => { generation.current++; subscription.remove(); };
  }, [refresh]);
}
```

这个 Hook 只负责恢复事件。请求层仍需用 `AbortController` 或请求代次阻止旧响应写入缓存；展示列表前还要按服务端版本或更新时间校验。否则“请求发起顺序”无法保证“数据新旧顺序”。

## 验收场景

- 切到后台超过刷新窗口再返回，只产生一次有效刷新；短暂切换不闪动。
- A 账户的请求未结束就切到 B 账户，A 的响应不会进入 B 的缓存。
- 断网返回显示最后可信快照及更新时间，恢复网络后可手动重试。

参考：[React Native AppState](https://reactnative.dev/docs/appstate)。
