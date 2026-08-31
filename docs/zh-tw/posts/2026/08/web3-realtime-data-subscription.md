---
title: "DApp 前端即時資料訂閱架構：WebSocket、Reorg 與多分頁同步"
date: 2026-08-29 13:19:38
tags:
  - Web3
readingTime: 8
description: "dApp 前端的即時資料不只是接個 WebSocket。本文覆蓋 WS provider 訂閱 vs 輪詢 vs indexing service 的選型、斷線重連與重訂閱策略、鏈上 reorg 在 UI 狀態中的處理、BroadcastChannel 多分頁同步，以及 TanStack Query 融合訂閱與 REST 快照的整合模式。"
wordCount: 1572
---

做 DeFi dashboard 的前端，最讓人頭疼的不是 UI 複雜度，而是資料的即時性和一致性。使用者的持倉、待確認交易、池子 TVL 都在不斷變化，靠 REST 輪詢要麼延遲太高，要麼請求量爆炸。WebSocket 訂閱看起來是答案，但實際落地後會遇到斷線重連、鏈上 reorg 導致狀態回退、使用者開了三個分頁各自維護獨立狀態等一系列問題。

這篇文章整理我在一個 DeFi dashboard 專案中搭建即時資料層的完整經驗。技術棧是 React + viem + TanStack Query，但思路對其他框架同樣適用。

## 三種即時資料獲取方式的取捨

| 方式 | 延遲 | 伺服器端壓力 | 實作複雜度 | 適用場景 |
|------|------|-----------|-----------|---------|
| REST 輪詢 | 秒級 | 高（頻繁請求） | 低 | 低頻更新、降級方案 |
| WebSocket Provider | 毫秒級 | 低（推送） | 中 | 區塊頭、pending tx、事件監聽 |
| Indexing Service (Subgraph) | 秒~分鐘級 | 低（查詢） | 高 | 聚合資料、歷史查詢、複雜過濾 |

**WebSocket Provider**（Alchemy/Infura/自建節點的 `eth_subscribe`）適合需要即時回應的場景：新區塊到達、pending transaction 狀態變化、合約事件。缺點是連線不穩定，且單節點的資料可能不完整。

**Indexing Service**（The Graph / Goldsky / 自建 indexer）適合需要聚合或過濾的場景：某地址的所有 swap 歷史、某個 token 的持倉排行。它把鏈上原始資料預處理成結構化查詢介面。缺點是有索引延遲，不適合需要「剛發生就要看到」的場景。

**REST 輪詢**不應該被完全拋棄。它是 WebSocket 不可用時的降級方案，也是校驗訂閱資料一致性的基準。

我們的架構選擇是：核心即時資料走 WebSocket，聚合資料走 Subgraph，REST 作為 fallback 和校驗源。

## WebSocket 訂閱的重連與重訂閱

生產環境中 WebSocket 斷開是常態而非異常。網路波動、代理逾時、節點重新啟動都會導致斷連。一個簡單的 reconnect 不夠——你還需要重新訂閱之前的所有 topic。

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
    // 如果尚未連線，connect() 建立後會自動訂閱所有已註冊的 subscription
    return id;
  }

  unsubscribe(id: string) {
    this.subscriptions.delete(id);
    // 傳送 eth_unsubscribe...
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // 重連後重新訂閱所有活躍 subscription
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
      // onclose 會在 onerror 之後觸發，這裡只做日誌
      console.error('[WS] Connection error');
    };
  }

  private scheduleReconnect() {
    // 指數退避 + 抖動，避免雷群效應
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

幾個關鍵設計點：

- **subscription registry**：所有活躍訂閱存在記憶體 map 裡。重連時遍歷 map 重新傳送 `eth_subscribe`，不需要業務層感知斷連。
- **指數退避 + 抖動**：純指數退避在大量客戶端同時斷連時會造成「雷群效應」（thundering herd）。加隨機抖動分散重連時間。
- **訊息緩衝**：上面的簡化版沒有展示訊息緩衝。生產環境應該在斷連期間快取未確認的狀態變更，重連後用 REST 拉一次最新快照做校準，再恢復訂閱推送。

## 鏈上 Reorg 在 UI 狀態中的處理

以太坊 L1 平均每天發生幾次小範圍 reorg，L2 更少但不是零。對前端來說，reorg 意味著之前顯示為「confirmed」的交易可能被回退。

我們在 UI 中引入了三級狀態模型：

```typescript
type TxUiStatus =
  | { phase: 'pending'; submittedAt: number }
  | { phase: 'confirmed'; blockNumber: bigint; confirmations: number }
  | { phase: 'reorged'; previousBlock: bigint; reason: string }
  | { phase: 'failed'; error: string };

// 追蹤確認數，達到安全閾值後才標記為 final
function useTransactionStatus(txHash: `0x${string}`) {
  const [status, setStatus] = useState<TxUiStatus>({ phase: 'pending', submittedAt: Date.now() });
  const safeConfirmations = 12n; // L1 常用閾值；L2 可設為 1

  useEffect(() => {
    const unsub = subscriber.subscribe({
      type: 'newHeads',
      params: ['newHeads'],
    }, async (newHead) => {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        // 交易不在任何區塊中 → 可能被 reorg 了
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

UI 層面的呈現規則：

- **pending**：顯示載入動畫 + 「等待確認」
- **confirmed (confirmations < safe)**：顯示綠色勾 + 「N/12 確認」，進度條遞增
- **confirmed (confirmations >= safe)**：顯示綠色勾 + 「已確認」
- **reorged**：顯示黃色警告 + 「交易被重組，正在重新確認...」，自動回到 pending 觀察
- **failed**：顯示紅色叉 + 錯誤原因

reorg 狀態的持續時間通常很短（幾秒到幾十秒），UI 不應該彈 modal 打斷使用者，而是用 inline banner 提示。

## 多分頁狀態同步：BroadcastChannel

使用者經常開多個分頁看同一個 dApp——一個看 portfolio，一個看 swap，一個看 governance。每個分頁各自維護 WebSocket 連線既浪費資源又可能導致狀態不一致。

BroadcastChannel API 讓同源分頁之間可以互相廣播訊息：

```typescript
class CrossTabSync {
  private channel: BroadcastChannel;
  private isLeader = false;
  private leaderId: string | null = null;
  private tabId = crypto.randomUUID();

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event) => this.handleMessage(event.data);

    // Leader election: 第一個開啟的分頁成為 leader
    this.channel.postMessage({ type: 'election', tabId: this.tabId });
  }

  private handleMessage(msg: CrossTabMessage) {
    switch (msg.type) {
      case 'election':
        // 簡單策略：tabId 字典序最小的當 leader
        if (!this.leaderId || msg.tabId < this.leaderId) {
          this.leaderId = msg.tabId;
          this.isLeader = msg.tabId === this.tabId;
        }
        break;

      case 'state-update':
        // 非 leader 分頁接收 leader 推送的狀態
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

  // Leader 定期發心跳，掛了其他分頁接管
  startHeartbeat(intervalMs = 3000) {
    setInterval(() => {
      if (this.isLeader) {
        this.channel.postMessage({ type: 'leader-heartbeat', tabId: this.tabId });
      }
    }, intervalMs);
  }

  private applyRemoteState(key: string, value: unknown) {
    // 更新本機 store/cache
    window.dispatchEvent(new CustomEvent('cross-tab-state', {
      detail: { key, value },
    }));
  }
}
```

這個設計的核心思想是：**只有一個分頁持有 WebSocket 連線（leader）**，其他分頁透過 BroadcastChannel 接收狀態更新。好處是減少了對 RPC 節點的連線數和請求量，也避免了多分頁之間的資料競爭。

注意 BroadcastChannel 只在同源分頁之間工作，不支援跨域也不支援 Service Worker。對於更複雜的場景可以考慮 SharedWorker，但大多數 dApp 用 BroadcastChannel 就夠了。

## WebSocket 被阻斷時的降級

企業網路和部分地區的 ISP 會封鎖 WebSocket。偵測和處理策略：

```typescript
async function createTransport(): Promise<Transport> {
  // 先嘗試 WebSocket
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
    // WebSocket 不可用
  }

  // 降級到 HTTP polling
  console.warn('[Transport] WebSocket unavailable, falling back to HTTP polling');
  return http(httpRpcUrl, {
    retryCount: 3,
    retryDelay: 2000,
  });
}
```

降級後的使用者體驗差異應該在 UI 上有體現：頁面頂部顯示一條不顯眼的提示「即時資料已切換為定時重新整理模式」，讓使用者知道資料可能有幾秒延遲。不要假裝一切正常——使用者在不知情的情況下做出基於過時資料的交易決策才是真正的風險。

## TanStack Query 整合：訂閱 + REST 快照融合

TanStack Query 管理的是 REST/API 資料，WebSocket 推送的是增量事件。兩者需要一個橋樑：

```typescript
function useTokenBalance(address: Address, token: Address) {
  // REST 快照作為基礎資料
  const query = useQuery({
    queryKey: ['tokenBalance', address, token],
    queryFn: () => fetchBalance(address, token),
    refetchInterval: false, // 關閉自動輪詢，由訂閱驅動更新
    staleTime: 30_000,
  });

  // WebSocket 訂閱驅動增量更新
  useEffect(() => {
    const subId = subscriber.subscribe({
      type: 'logs',
      params: [{
        address: token,
        topics: [transferEventTopic, null, address], // Transfer to this address
      }],
    }, (log) => {
      // 收到 Transfer 事件時，使 query cache 失效並重新拉取
      queryClient.invalidateQueries({
        queryKey: ['tokenBalance', address, token],
      });
    });

    return () => subscriber.unsubscribe(subId);
  }, [address, token]);

  return query;
}
```

為什麼不直接用訂閱資料更新快取？因為 Transfer 事件只告訴你「有轉入」，不包含最新餘額。餘額還可能受 approve/spend/rebase 等其他操作影響。所以訂閱的作用是**觸發 invalidation**，真正的資料仍然從 REST/RPC 讀取，保證準確性。

對於高頻更新的場景（比如價格 ticker），可以做節流：

```typescript
// 每 500ms 最多 invalidate 一次，避免密集事件打爆 RPC
const throttledInvalidate = useMemo(
  () => throttle(
    () => queryClient.invalidateQueries({ queryKey: ['price', pair] }),
    500,
  ),
  [pair],
);
```

這種「訂閱驅動 invalidation + REST 提供真相」的模式兼顧了即時性和資料一致性。訂閱負責「什麼時候該更新」，REST 負責「更新成什麼值」。

## 小結

dApp 前端的即時資料層需要解決四個問題：連線可靠性（重連重訂閱）、資料一致性（reorg 處理）、資源效率（多分頁同步）、可用性（WS 降級）。沒有單一方案能覆蓋所有場景，通常是 WebSocket + REST + Indexer 的組合。TanStack Query 在這個組合中扮演了快取管理者和資料融合點的角色。最重要的原則是：永遠不要假設連線是穩定的，永遠不要信任未經確認的資料，永遠給使用者可見的狀態回饋。
