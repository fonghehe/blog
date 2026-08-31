---
title: "DApp 前端实时数据订阅架构：WebSocket、Reorg 与多标签同步"
date: 2026-08-29 13:19:38
tags:
  - Web3
readingTime: 8
description: "dApp 前端的实时数据不只是接个 WebSocket。本文覆盖 WS provider 订阅 vs 轮询 vs indexing service 的选型、断线重连与重订阅策略、链上 reorg 在 UI 状态中的处理、BroadcastChannel 多标签同步，以及 TanStack Query 融合订阅与 REST 快照的集成模式。"
wordCount: 1564
---

做 DeFi dashboard 的前端，最让人头疼的不是 UI 复杂度，而是数据的实时性和一致性。用户的持仓、待确认交易、池子 TVL 都在不断变化，靠 REST 轮询要么延迟太高，要么请求量爆炸。WebSocket 订阅看起来是答案，但实际落地后会遇到断线重连、链上 reorg 导致状态回退、用户开了三个标签页各自维护独立状态等一系列问题。

这篇文章整理我在一个 DeFi dashboard 项目中搭建实时数据层的完整经验。技术栈是 React + viem + TanStack Query，但思路对其他框架同样适用。

## 三种实时数据获取方式的取舍

| 方式 | 延迟 | 服务端压力 | 实现复杂度 | 适用场景 |
|------|------|-----------|-----------|---------|
| REST 轮询 | 秒级 | 高（频繁请求） | 低 | 低频更新、兜底方案 |
| WebSocket Provider | 毫秒级 | 低（推送） | 中 | 区块头、pending tx、事件监听 |
| Indexing Service (Subgraph) | 秒~分钟级 | 低（查询） | 高 | 聚合数据、历史查询、复杂过滤 |

**WebSocket Provider**（Alchemy/Infura/自建节点的 `eth_subscribe`）适合需要即时响应的场景：新区块到达、pending transaction 状态变化、合约事件。缺点是连接不稳定，且单节点的数据可能不完整。

**Indexing Service**（The Graph / Goldsky / 自建 indexer）适合需要聚合或过滤的场景：某地址的所有 swap 历史、某个 token 的持仓排行。它把链上原始数据预处理成结构化查询接口。缺点是有索引延迟，不适合需要"刚发生就要看到"的场景。

**REST 轮询**不应该被完全抛弃。它是 WebSocket 不可用时的降级方案，也是校验订阅数据一致性的基准。

我们的架构选择是：核心实时数据走 WebSocket，聚合数据走 Subgraph，REST 作为 fallback 和校验源。

## WebSocket 订阅的重连与重订阅

生产环境中 WebSocket 断开是常态而非异常。网络波动、代理超时、节点重启都会导致断连。一个简单的 reconnect 不够——你还需要重新订阅之前的所有 topic。

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
    // 如果尚未连接，connect() 建立后会自动订阅所有已注册的 subscription
    return id;
  }

  unsubscribe(id: string) {
    this.subscriptions.delete(id);
    // 发送 eth_unsubscribe...
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // 重连后重新订阅所有活跃 subscription
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
      // onclose 会在 onerror 之后触发，这里只做日志
      console.error('[WS] Connection error');
    };
  }

  private scheduleReconnect() {
    // 指数退避 + 抖动，避免雷群效应
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

几个关键设计点：

- **subscription registry**：所有活跃订阅存在内存 map 里。重连时遍历 map 重新发送 `eth_subscribe`，不需要业务层感知断连。
- **指数退避 + 抖动**：纯指数退避在大量客户端同时断连时会造成"雷群效应"（thundering herd）。加随机抖动分散重连时间。
- **消息缓冲**：上面的简化版没有展示消息缓冲。生产环境应该在断连期间缓存未确认的状态变更，重连后用 REST 拉一次最新快照做校准，再恢复订阅推送。

## 链上 Reorg 在 UI 状态中的处理

以太坊 L1 平均每天发生几次小范围 reorg，L2 更少但不是零。对前端来说，reorg 意味着之前显示为"confirmed"的交易可能被回退。

我们在 UI 中引入了三级状态模型：

```typescript
type TxUiStatus =
  | { phase: 'pending'; submittedAt: number }
  | { phase: 'confirmed'; blockNumber: bigint; confirmations: number }
  | { phase: 'reorged'; previousBlock: bigint; reason: string }
  | { phase: 'failed'; error: string };

// 跟踪确认数，达到安全阈值后才标记为 final
function useTransactionStatus(txHash: `0x${string}`) {
  const [status, setStatus] = useState<TxUiStatus>({ phase: 'pending', submittedAt: Date.now() });
  const safeConfirmations = 12n; // L1 常用阈值；L2 可设为 1

  useEffect(() => {
    const unsub = subscriber.subscribe({
      type: 'newHeads',
      params: ['newHeads'],
    }, async (newHead) => {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        // 交易不在任何区块中 → 可能被 reorg 了
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

UI 层面的呈现规则：

- **pending**：显示加载动画 + "等待确认"
- **confirmed (confirmations < safe)**：显示绿色勾 + "N/12 确认"，进度条递增
- **confirmed (confirmations >= safe)**：显示绿色勾 + "已确认"
- **reorged**：显示黄色警告 + "交易被重组，正在重新确认..."，自动回到 pending 观察
- **failed**：显示红色叉 + 错误原因

reorg 状态的持续时间通常很短（几秒到几十秒），UI 不应该弹 modal 打断用户，而是用 inline banner 提示。

## 多标签页状态同步：BroadcastChannel

用户经常开多个标签页看同一个 dApp——一个看 portfolio，一个看 swap，一个看 governance。每个标签页各自维护 WebSocket 连接既浪费资源又可能导致状态不一致。

BroadcastChannel API 让同源标签页之间可以互相广播消息：

```typescript
class CrossTabSync {
  private channel: BroadcastChannel;
  private isLeader = false;
  private leaderId: string | null = null;
  private tabId = crypto.randomUUID();

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event) => this.handleMessage(event.data);

    // Leader election: 第一个打开的标签页成为 leader
    this.channel.postMessage({ type: 'election', tabId: this.tabId });
  }

  private handleMessage(msg: CrossTabMessage) {
    switch (msg.type) {
      case 'election':
        // 简单策略：tabId 字典序最小的当 leader
        if (!this.leaderId || msg.tabId < this.leaderId) {
          this.leaderId = msg.tabId;
          this.isLeader = msg.tabId === this.tabId;
        }
        break;

      case 'state-update':
        // 非 leader 标签页接收 leader 推送的状态
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

  // Leader 定期发心跳，挂了其他标签页接管
  startHeartbeat(intervalMs = 3000) {
    setInterval(() => {
      if (this.isLeader) {
        this.channel.postMessage({ type: 'leader-heartbeat', tabId: this.tabId });
      }
    }, intervalMs);
  }

  private applyRemoteState(key: string, value: unknown) {
    // 更新本地 store/cache
    window.dispatchEvent(new CustomEvent('cross-tab-state', {
      detail: { key, value },
    }));
  }
}
```

这个设计的核心思想是：**只有一个标签页持有 WebSocket 连接（leader）**，其他标签页通过 BroadcastChannel 接收状态更新。好处是减少了对 RPC 节点的连接数和请求量，也避免了多标签页之间的数据竞争。

注意 BroadcastChannel 只在同源标签页之间工作，不支持跨域也不支持 Service Worker。对于更复杂的场景可以考虑 SharedWorker，但大多数 dApp 用 BroadcastChannel 就够了。

## WebSocket 被阻断时的降级

企业网络和部分地区的 ISP 会封锁 WebSocket。检测和处理策略：

```typescript
async function createTransport(): Promise<Transport> {
  // 先尝试 WebSocket
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

  // 降级到 HTTP polling
  console.warn('[Transport] WebSocket unavailable, falling back to HTTP polling');
  return http(httpRpcUrl, {
    retryCount: 3,
    retryDelay: 2000,
  });
}
```

降级后的用户体验差异应该在 UI 上有体现：页面顶部显示一条不显眼的提示"实时数据已切换为定时刷新模式"，让用户知道数据可能有几秒延迟。不要假装一切正常——用户在不知情的情况下做出基于过时数据的交易决策才是真正的风险。

## TanStack Query 集成：订阅 + REST 快照融合

TanStack Query 管理的是 REST/API 数据，WebSocket 推送的是增量事件。两者需要一个桥梁：

```typescript
function useTokenBalance(address: Address, token: Address) {
  // REST 快照作为基础数据
  const query = useQuery({
    queryKey: ['tokenBalance', address, token],
    queryFn: () => fetchBalance(address, token),
    refetchInterval: false, // 关闭自动轮询，由订阅驱动更新
    staleTime: 30_000,
  });

  // WebSocket 订阅驱动增量更新
  useEffect(() => {
    const subId = subscriber.subscribe({
      type: 'logs',
      params: [{
        address: token,
        topics: [transferEventTopic, null, address], // Transfer to this address
      }],
    }, (log) => {
      // 收到 Transfer 事件时，使 query cache 失效并重新拉取
      queryClient.invalidateQueries({
        queryKey: ['tokenBalance', address, token],
      });
    });

    return () => subscriber.unsubscribe(subId);
  }, [address, token]);

  return query;
}
```

为什么不直接用订阅数据更新 cache？因为 Transfer 事件只告诉你"有转入"，不包含最新余额。余额还可能受 approve/spend/rebase 等其他操作影响。所以订阅的作用是**触发 invalidation**，真正的数据仍然从 REST/RPC 读取，保证准确性。

对于高频更新的场景（比如价格 ticker），可以做节流：

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

这种"订阅驱动 invalidation + REST 提供真相"的模式兼顾了实时性和数据一致性。订阅负责"什么时候该更新"，REST 负责"更新成什么值"。

## 小结

dApp 前端的实时数据层需要解决四个问题：连接可靠性（重连重订阅）、数据一致性（reorg 处理）、资源效率（多标签同步）、可用性（WS 降级）。没有单一方案能覆盖所有场景，通常是 WebSocket + REST + Indexer 的组合。TanStack Query 在这个组合中扮演了 cache 管理者和数据融合点的角色。最重要的原则是：永远不要假设连接是稳定的，永远不要信任未经确认的数据，永远给用户可见的状态反馈。
