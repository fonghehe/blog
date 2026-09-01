---
title: "React Native 前后台切换：让列表恢复后拿到可信数据"
date: 2026-09-01 19:08:53
tags:
  - 移动端
description: "用 AppState、请求代次和服务端版本处理 React Native 页面恢复，避免旧请求覆盖新数据。"
readingTime: 3
wordCount: 805
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

## 用订单列表走一遍复归流程

假设用户在列表页切到支付应用，两分钟后返回。此时内存里仍有十条订单，但其中一笔已在另一台设备取消。界面应先保留上一次**已确认**的快照和“上次同步”时间，再显示轻量刷新状态；如果请求失败，继续显示旧快照并提示数据可能过期。只有服务器明确返回空集合，才显示“暂无订单”。这样用户不会在每次切换应用时看见白屏，也不会把网络故障当成订单消失。

把 `AppState` 视作触发器，而不是数据正确性的来源。示例 Hook 里的 `generation` 只控制日志，不能阻止 `refresh()` 自己写入旧数据；真正的世代检查必须放在数据仓库的写入点。请求带上发起时的 `accountId` 和递增的 `requestId`，响应提交前同时比较当前账号和请求编号。账号切换时先清空账号作用域的缓存，再使所有旧请求失效。若服务端提供版本号，只有版本不低于当前版本的响应才可以覆盖快照。

```ts
// 伪代码：检查与写入必须发生在同一条状态更新路径上
const ticket = { accountId: session.accountId, requestId: ++latestRequestId };
const result = await api.listOrders(ticket.accountId);
if (ticket.accountId !== session.accountId || ticket.requestId !== latestRequestId) return;
if (result.version < store.version) return;
store.replace({ items: result.items, version: result.version, syncedAt: Date.now() });
```

## 把竞态写成验收用例

用可控 Promise 制造先发后到的两个响应，确认较旧的请求不能覆盖较新的列表；在 A 的请求未完成时切到 B，确认 A 的内容从未进入 B 的缓存。再测试短暂切出后回来、离线复归、令牌失效和服务端返回真正空列表。记录刷新触发原因、请求耗时和丢弃旧响应的次数，才能分辨“复归没有触发”和“触发后被正确忽略”。

参考：[React Native AppState](https://reactnative.dev/docs/appstate)。
