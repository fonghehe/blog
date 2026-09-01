---
title: "React Native App Resume: Refresh Lists Without Showing Stale Data"
date: 2026-09-01 19:08:53
tags:
  - Mobile
description: "Use AppState, request generations, and server versions to keep resumed React Native screens trustworthy."
readingTime: 3
wordCount: 465
---

A mobile screen can survive in memory while its orders, prices, and session have already changed. Refetching on every `active` event is not enough: rapid app switching creates overlapping requests, and an older response may arrive last.

## Decide when to refresh

Keep the last successful sync time together with the account ID. Refresh only after a transition from an inactive state to `active` and when the snapshot exceeds the business freshness window. Changing accounts invalidates private caches immediately. A network reconnect can use the same refresh entry point, but connectivity does not prove that the API is reachable.

The `AppState` listener should own only the resume event. The request layer must abort or ignore obsolete generations before writing to a cache. Compare a server version or update timestamp as well: request order is not necessarily data order.

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
        if (request === generation.current) console.warn('Refresh failed', error);
      });
    });
    return () => { generation.current++; subscription.remove(); };
  }, [refresh]);
}
```

## Verify the race, not just the happy path

- A short app switch should not blank the list; a longer pause should trigger one effective refresh.
- If account A has a pending request when the user switches to B, A's response must never populate B's cache.
- Offline resume should retain the last trusted snapshot, show its sync time, and offer retry.

See the [React Native AppState documentation](https://reactnative.dev/docs/appstate).

## Walk through an order-list resume

Imagine a customer leaving the order list for a payment app and returning two minutes later. Ten orders remain in memory, but one was cancelled on another device. Keep the last **confirmed** snapshot and its sync time on screen while a small refresh indicator runs. If the request fails, retain that snapshot and say it may be stale. Show an empty state only after a successful response explicitly contains no orders. A failed network call is not evidence that the customer has no orders.

Treat `AppState` as a trigger, not as the source of data correctness. The `generation` in the Hook above only guards its error log; it does not stop `refresh()` from writing an older response. Put the generation check at the repository's commit point. Capture `accountId` and an increasing `requestId` when starting a request, then compare both immediately before applying its result. Switching accounts first clears account-scoped data and invalidates pending requests. If the API returns a monotonic version, reject responses older than the snapshot already on screen.

```ts
// Pseudocode: validation and the store write share one update path.
const ticket = { accountId: session.accountId, requestId: ++latestRequestId };
const result = await api.listOrders(ticket.accountId);
if (ticket.accountId !== session.accountId || ticket.requestId !== latestRequestId) return;
if (result.version < store.version) return;
store.replace({ items: result.items, version: result.version, syncedAt: Date.now() });
```

## Turn races into acceptance cases

Use controllable promises to resolve two requests in reverse order and verify that the older response cannot replace the newer list. Switch from account A to B while A's request is pending and assert that A's rows never enter B's cache. Also cover a brief app switch, an offline resume, an expired token, and a genuinely empty server response. Log the refresh reason, duration, and discarded-response count: these distinguish a missing resume event from an event whose obsolete request was correctly ignored.
