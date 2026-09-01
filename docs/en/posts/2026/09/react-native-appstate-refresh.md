---
title: "React Native App Resume: Refresh Lists Without Showing Stale Data"
date: 2026-09-01 19:08:53
tags:
  - Mobile
description: "Use AppState, request generations, and server versions to keep resumed React Native screens trustworthy."
readingTime: 1
wordCount: 203
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
