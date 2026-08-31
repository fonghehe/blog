---
title: "DApp Frontend Real-Time Data Subscription Architecture: WebSocket, Reorgs, and Multi-Tab Sync"
date: 2026-08-29 13:19:38
tags:
  - Web3
readingTime: 7
description: "Real-time data in dApp frontends is more than plugging in a WebSocket. This article covers WS provider subscriptions vs polling vs indexing service trade-offs, reconnection and resubscription strategies, on-chain reorg handling in UI state, BroadcastChannel multi-tab sync, and TanStack Query patterns for fusing subscriptions with REST snapshots."
wordCount: 894
---

Building the frontend for a DeFi dashboard, the hardest part isn't UI complexity — it's data real-time performance and consistency. User positions, pending transactions, and pool TVL are all constantly changing. REST polling either has too much latency or generates an explosion of requests. WebSocket subscriptions look like the answer, but production reality brings reconnection challenges, on-chain reorgs reverting state, and users opening three tabs each maintaining independent state.

This article captures my complete experience building a real-time data layer for a DeFi dashboard project. The stack is React + viem + TanStack Query, but the principles apply equally to other frameworks.

## Trade-Offs Between Three Real-Time Data Approaches

| Approach | Latency | Server Load | Implementation Complexity | Use Cases |
|----------|---------|-------------|--------------------------|-----------|
| REST Polling | Seconds | High (frequent requests) | Low | Low-frequency updates, fallback |
| WebSocket Provider | Milliseconds | Low (push) | Medium | Block headers, pending txs, event listening |
| Indexing Service (Subgraph) | Seconds to minutes | Low (query) | High | Aggregated data, historical queries, complex filters |

**WebSocket Provider** (Alchemy/Infura/self-hosted node `eth_subscribe`) suits scenarios needing instant response: new block arrivals, pending transaction status changes, contract events. Downsides: unstable connections and potentially incomplete data from single nodes.

**Indexing Service** (The Graph / Goldsky / self-built indexer) suits aggregation or filtering scenarios: all swap history for an address, token holder rankings. It preprocesses raw on-chain data into structured query interfaces. Downside: indexing lag makes it unsuitable for "just happened, need to see it now" scenarios.

**REST Polling** shouldn't be completely abandoned. It's the fallback when WebSocket is unavailable and serves as the baseline for validating subscription data consistency.

Our architecture choice: core real-time data via WebSocket, aggregated data via Subgraph, REST as fallback and validation source.

## WebSocket Subscription Reconnection and Resubscription

In production, WebSocket disconnections are the norm, not the exception. Network fluctuations, proxy timeouts, and node restarts all cause drops. A simple reconnect isn't enough — you also need to resubscribe to all previous topics.

```typescript
class ResilientWsSubscriber {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private onEvent: (subId: string, data: unknown) => void;

  constructor(
    private url: string,
    onEvent: (subId: string, data: unknown) => void,
  ) {
    this.onEvent = onEvent;
  }

  subscribe(config: SubscriptionConfig): string {
    const id = crypto.randomUUID();
    this.subscriptions.set(id, config);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(id, config);
    }
    // If not yet connected, connect() will auto-subscribe all registered subscriptions
    return id;
  }

  unsubscribe(id: string) {
    this.subscriptions.delete(id);
    // Send eth_unsubscribe...
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Resubscribe all active subscriptions after reconnect
      for (const [id, config] of this.subscriptions) {
        this.sendSubscribe(id, config);
      }
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'eth_subscription') {
        this.onEvent(msg.params.subscription, msg.params.result);
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose fires after onerror, just log here
      console.error('[WS] Connection error');
    };
  }

  private scheduleReconnect() {
    // Exponential backoff + jitter to avoid thundering herd
    const baseDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    const jitter = Math.random() * baseDelay * 0.3;
    const delay = baseDelay + jitter;

    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private sendSubscribe(id: string, config: SubscriptionConfig) {
    this.ws?.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'eth_subscribe',
      params: config.params,
    }));
  }
}
```

Key design points:

- **Subscription registry**: all active subscriptions stored in an in-memory map. On reconnect, iterate the map and resend `eth_subscribe` — the business layer doesn't need to know about disconnections.
- **Exponential backoff + jitter**: pure exponential backoff causes a "thundering herd" when many clients disconnect simultaneously. Random jitter spreads out reconnection timing.
- **Message buffering**: the simplified version above doesn't show message buffering. In production, buffer uncommitted state changes during disconnection, pull a fresh snapshot via REST after reconnecting for reconciliation, then resume subscription pushes.

## Handling On-Chain Reorgs in UI State

Ethereum L1 averages several small reorgs per day; L2 has fewer but not zero. For the frontend, a reorg means a transaction previously shown as "confirmed" may be reverted.

We introduced a three-level state model in the UI:

```typescript
type TxUiStatus =
  | { phase: 'pending'; submittedAt: number }
  | { phase: 'confirmed'; blockNumber: bigint; confirmations: number }
  | { phase: 'reorged'; previousBlock: bigint; reason: string }
  | { phase: 'failed'; error: string };

// Track confirmation count, mark as final only after reaching safe threshold
function useTransactionStatus(txHash: `0x${string}`) {
  const [status, setStatus] = useState<TxUiStatus>({ phase: 'pending', submittedAt: Date.now() });
  const safeConfirmations = 12n; // Common L1 threshold; can set to 1 for L2

  useEffect(() => {
    const unsub = subscriber.subscribe({
      type: 'newHeads',
      params: ['newHeads'],
    }, async (newHead) => {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        // Transaction not in any block → possibly reorged
        if (status.phase === 'confirmed') {
          setStatus({
            phase: 'reorged',
            previousBlock: receipt?.blockNumber ?? 0n,
            reason: 'Transaction no longer in canonical chain',
          });
        }
        return;
      }

      const currentBlock = BigInt(newHead.number);
      const confirmations = currentBlock - receipt.blockNumber + 1n;

      if (confirmations >= safeConfirmations) {
        setStatus({
          phase: 'confirmed',
          blockNumber: receipt.blockNumber,
          confirmations: Number(confirmations),
        });
      } else {
        setStatus({
          phase: 'confirmed',
          blockNumber: receipt.blockNumber,
          confirmations: Number(confirmations),
        });
      }
    });

    return () => subscriber.unsubscribe(unsub);
  }, [txHash]);

  return status;
}
```

UI presentation rules:

- **Pending**: show loading animation + "Awaiting confirmation"
- **Confirmed (confirmations < safe)**: show green checkmark + "N/12 confirmations" with progress bar incrementing
- **Confirmed (confirmations >= safe)**: show green checkmark + "Confirmed"
- **Reorged**: show yellow warning + "Transaction reorganized, re-confirming..." and automatically return to pending observation
- **Failed**: show red X + error reason

Reorg states typically last briefly (seconds to tens of seconds). The UI shouldn't pop a modal to interrupt the user — use an inline banner instead.

## Multi-Tab State Synchronization: BroadcastChannel

Users frequently open multiple tabs for the same dApp — one for portfolio, one for swaps, one for governance. Each tab maintaining its own WebSocket connection wastes resources and risks state inconsistency.

The BroadcastChannel API lets same-origin tabs broadcast messages to each other:

```typescript
class CrossTabSync {
  private channel: BroadcastChannel;
  private isLeader = false;
  private leaderId: string | null = null;
  private tabId = crypto.randomUUID();

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event) => this.handleMessage(event.data);

    // Leader election: first tab to open becomes leader
    this.channel.postMessage({ type: 'election', tabId: this.tabId });
  }

  private handleMessage(msg: CrossTabMessage) {
    switch (msg.type) {
      case 'election':
        // Simple strategy: lexicographically smallest tabId becomes leader
        if (!this.leaderId || msg.tabId < this.leaderId) {
          this.leaderId = msg.tabId;
          this.isLeader = msg.tabId === this.tabId;
        }
        break;

      case 'state-update':
        // Non-leader tabs receive state pushed by leader
        if (!this.isLeader && msg.tabId === this.leaderId) {
          this.applyRemoteState(msg.key, msg.value);
        }
        break;

      case 'leader-heartbeat':
        if (msg.tabId === this.leaderId) {
          this.resetLeaderTimeout();
        }
        break;
    }
  }

  broadcast(key: string, value: unknown) {
    if (this.isLeader) {
      this.channel.postMessage({
        type: 'state-update',
        tabId: this.tabId,
        key,
        value,
      });
    }
  }

  // Leader sends periodic heartbeat; other tabs take over if it dies
  startHeartbeat(intervalMs = 3000) {
    setInterval(() => {
      if (this.isLeader) {
        this.channel.postMessage({ type: 'leader-heartbeat', tabId: this.tabId });
      }
    }, intervalMs);
  }

  private applyRemoteState(key: string, value: unknown) {
    // Update local store/cache
    window.dispatchEvent(new CustomEvent('cross-tab-state', {
      detail: { key, value },
    }));
  }
}
```

The core idea: **only one tab holds the WebSocket connection (the leader)**, while other tabs receive state updates via BroadcastChannel. Benefits include reduced RPC node connections and request volume, plus avoiding data races between tabs.

Note that BroadcastChannel only works between same-origin tabs — no cross-origin support and no Service Worker support. For more complex scenarios, consider SharedWorker, but BroadcastChannel suffices for most dApps.

## Fallback When WebSocket Is Blocked

Corporate networks and some regional ISPs block WebSocket. Detection and handling strategy:

```typescript
async function createTransport(): Promise<Transport> {
  // Try WebSocket first
  try {
    const ws = new WebSocket(wsRpcUrl);
    const connected = await Promise.race([
      new Promise<boolean>((resolve) => {
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);

    if (connected) {
      ws.close();
      return webSocket(wsRpcUrl);
    }
  } catch {
    // WebSocket unavailable
  }

  // Fall back to HTTP polling
  console.warn('[Transport] WebSocket unavailable, falling back to HTTP polling');
  return http(httpRpcUrl, {
    retryCount: 3,
    retryDelay: 2000,
  });
}
```

The degraded user experience should be reflected in the UI: display a subtle banner at the top saying "Real-time data switched to periodic refresh mode" so users know data may have a few seconds of delay. Don't pretend everything is normal — users making trading decisions based on stale data without knowing it is the real risk.

## TanStack Query Integration: Fusing Subscriptions with REST Snapshots

TanStack Query manages REST/API data, while WebSocket pushes incremental events. The two need a bridge:

```typescript
function useTokenBalance(address: Address, token: Address) {
  // REST snapshot as base data
  const query = useQuery({
    queryKey: ['tokenBalance', address, token],
    queryFn: () => fetchBalance(address, token),
    refetchInterval: false, // Disable auto-polling; updates driven by subscription
    staleTime: 30_000,
  });

  // WebSocket subscription drives incremental updates
  useEffect(() => {
    const subId = subscriber.subscribe({
      type: 'logs',
      params: [{
        address: token,
        topics: [transferEventTopic, null, address], // Transfer to this address
      }],
    }, (log) => {
      // On Transfer event, invalidate query cache and refetch
      queryClient.invalidateQueries({
        queryKey: ['tokenBalance', address, token],
      });
    });

    return () => subscriber.unsubscribe(subId);
  }, [address, token]);

  return query;
}
```

Why not update the cache directly from subscription data? Because a Transfer event only tells you "something was transferred in" — it doesn't contain the latest balance. Balances can also change through approve/spend/rebase and other operations. So the subscription's role is **triggering invalidation**, while actual data still comes from REST/RPC to guarantee accuracy.

For high-frequency update scenarios (e.g., price tickers), throttle:

```typescript
// Invalidate at most once per 500ms to prevent dense events from hammering RPC
const throttledInvalidate = useMemo(
  () => throttle(
    () => queryClient.invalidateQueries({ queryKey: ['price', pair] }),
    500,
  ),
  [pair],
);
```

This "subscription-driven invalidation + REST provides truth" pattern balances real-time responsiveness with data consistency. Subscriptions handle "when to update," REST handles "what to update to."

## Summary

A dApp frontend's real-time data layer needs to solve four problems: connection reliability (reconnection and resubscription), data consistency (reorg handling), resource efficiency (multi-tab sync), and availability (WS fallback). No single solution covers all scenarios — it's typically a combination of WebSocket + REST + Indexer. TanStack Query plays the role of cache manager and data fusion point in this combination. The most important principles: never assume connections are stable, never trust unconfirmed data, and always give users visible state feedback.
