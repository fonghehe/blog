---
title: "Web3 交易狀態管理與 UX 設計"
date: 2025-01-08 20:59:43
tags:
  - Web3
  - DApp
readingTime: 9
description: "系統性分析 Web3 交易生命週期的各階段，提供完整的前端狀態機設計與交易追蹤方案"
wordCount: 1042
---

## Web3 交易生命週期的完整階段

Web3 交易的生命週期遠比 Web2 的 HTTP 請求複雜。一筆交易從用戶簽名到最終確認，需要經過多個異步階段，每個階段都可能失敗。前端必須為每個階段提供清晰的狀態反饋。

一筆典型的以太坊交易經歷以下階段：

```
用戶操作
   │
   ▼
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────┐
│  idle     │───▶│  signing │───▶│  pending     │───▶│ confirmed  │
│  (待操作) │    │  (簽名中) │    │  (內存池中)   │    │  (已上鍊)   │
└──────────┘    └──────────┘    └──────────────┘    └────────────┘
                      │               │                     │
                      ▼               ▼                     ▼
                 ┌──────────┐  ┌──────────┐          ┌──────────┐
                 │ rejected │  │  failed  │          │  final   │
                 │ (用戶拒絕)│  │ (執行失敗)│          │ (最終化)  │
                 └──────────┘  └──────────┘          └──────────┘
                                    │
                              ┌─────┴─────┐
                              │           │
                          ┌───▼───┐  ┌───▼───┐
                          │ revert│  │ oog   │
                          │(邏輯失敗)│ │(Gas不足)│
                          └───────┘  └───────┘
```

## pending 狀態：交易提交到內存池

當用戶簽名後，交易被廣播到內存池（mempool）。此時交易處於 pending 狀態，等待礦工/驗證者打包。

pending 階段的不確定性最高。交易可能：

- **被快速打包**：Gas 價格合適時，通常在 1-2 個區塊內打包
- **長時間等待**：Gas 價格偏低時，可能等待數小時
- **被替換**：用戶可以通過 RBF（Replace-By-Fee）或取消交易來替換
- **被丟棄**：如果 Gas 價格過低，節點可能從 mempool 中丟棄交易

前端在 pending 階段需要做的不僅是顯示"等待中"，還應該展示預估等待時間和 Gas 價格：

```typescript
// 估算 pending 時間
async function estimateConfirmationTime(
  publicClient: PublicClient,
  maxFeePerGas: bigint,
): Promise<{ estimatedBlocks: number; estimatedSeconds: number }> {
  const [block, feeHistory] = await Promise.all([
    publicClient.getBlock(),
    publicClient.getFeeHistory({
      blockCount: 20,
      rewardPercentiles: [50],
    }),
  ])

  const baseFee = block.baseFeePerGas!

  // 如果 maxFeePerGas < baseFee，交易不會被打包
  if (maxFeePerGas < baseFee) {
    return { estimatedBlocks: Infinity, estimatedSeconds: Infinity }
  }

  // 計算有效的 priority fee
  const effectivePriorityFee = maxFeePerGas - baseFee
  const recentPriorityFees = feeHistory.reward.flat()

  // 找到比當前 priority fee 低的交易佔比
  const lowerCount = recentPriorityFees.filter(
    (fee) => fee < effectivePriorityFee,
  ).length
  const percentile = lowerCount / recentPriorityFees.length

  // 百分位越高，確認越快
  const estimatedBlocks = Math.max(1, Math.ceil(3 / percentile))
  const estimatedSeconds = estimatedBlocks * 12 // 以太坊出塊時間

  return { estimatedBlocks, estimatedSeconds }
}
```

## confirmation：區塊確認數與最終性

交易被打包進區塊後，並不立即視為"最終確認"。不同場景需要不同的確認數：

- **小額交易**：1-3 個區塊確認即可
- **大額交易**：12+ 個區塊確認
- **跨鏈橋**：需要最終化（約 64 個區塊，~12.8 分鐘）
- **L2 交易**：通常 1 個區塊即可（軟確認），但提現需要 L1 最終化

```typescript
interface ConfirmationConfig {
  required: number        // 所需確認數
  final: number           // 最終化確認數
  label: (current: number) => string
}

function getConfirmationConfig(
  chainId: number,
  txValue: bigint,
): ConfirmationConfig {
  // 根據交易金額和鏈類型確定確認數
  if (txValue > parseEther('10')) {
    return {
      required: 12,
      final: 64,
      label: (c) => c >= 12 ? '安全確認' : `確認中 ${c}/12`,
    }
  }

  const chainConfigs: Record<number, ConfirmationConfig> = {
    1: { required: 3, final: 64, label: (c) => c >= 3 ? '已確認' : `確認中 ${c}/3` },
    10: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? '快速確認' : '確認中' },
    42161: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? '快速確認' : '確認中' },
  }

  return chainConfigs[chainId] ?? chainConfigs[1]
}
```

## failed：revert、out of gas、nonce 衝突

交易失敗有三種主要原因，前端需要準確區分：

**1. Revert（邏輯失敗）**

合約執行到 `require(false)` 或類似條件時觸發。交易上鍊但狀態回滾。前端需要解碼 revert reason：

```typescript
async function decodeRevertReason(
  publicClient: PublicClient,
  txHash: Hash,
): Promise<string> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

  if (receipt.status === 'success') {
    return 'Transaction succeeded'
  }

  // 方式一：通過 trace 獲取 revert reason
  try {
    const trace = await publicClient.request({
      method: 'trace_call',
      params: [
        { from: receipt.from, to: receipt.to, data: receipt.input, gas: receipt.gasUsed },
        ['trace'],
      ],
    })
    if (trace.error) {
      return decodeRevertData(trace.error)
    }
  } catch {
    // 方式二：重新模擬交易
    const tx = await publicClient.getTransaction({ hash: txHash })
    try {
      await publicClient.simulate({
        account: tx.from,
        to: tx.to!,
        data: tx.input,
        value: tx.value,
        gas: tx.gas,
      })
    } catch (error: any) {
      return error.shortMessage || error.message
    }
  }

  return 'Unknown revert reason'
}

function decodeRevertData(data: string): string {
  // 0x08c379a0 = Error(string) selector
  if (data.startsWith('0x08c379a0')) {
    const reason = decodeAbiParameters(
      [{ type: 'string' }],
      `0x${data.slice(10)}`,
    )
    return reason[0]
  }
  // 0x4e487b71 = Panic(uint256) selector
  if (data.startsWith('0x4e487b71')) {
    const code = decodeAbiParameters(
      [{ type: 'uint256' }],
      `0x${data.slice(10)}`,
    )
    return `Panic(${code[0]})`
  }
  return data
}
```

**2. Out of Gas**

交易的 Gas Limit 不足以完成執行。前端應在發送交易前準確估算 Gas：

```typescript
async function estimateGasWithBuffer(
  publicClient: PublicClient,
  tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
): Promise<bigint> {
  const estimated = await publicClient.estimateGas(tx)
  // 增加 20% 緩衝
  return (estimated * 120n) / 100n
}
```

**3. Nonce 衝突**

發送多筆交易時，如果 nonce 不連續，後續交易會卡在 pending 狀態：

```typescript
async function getNextNonce(
  publicClient: PublicClient,
  address: Address,
): Promise<number> {
  const pendingCount = await publicClient.getTransactionCount({
    address,
    blockTag: 'pending',
  })
  return pendingCount
}
```

## 前端狀態機設計

完整的交易狀態機應該是一個有限狀態自動機（FSM），每個狀態有明確的轉移條件：

```typescript
// 交易狀態機
type TransactionState =
  | { status: 'idle' }
  | { status: 'signing'; tx: TransactionRequest }
  | { status: 'pending'; hash: Hash; submittedAt: number }
  | { status: 'confirming'; hash: Hash; receipt: TransactionReceipt; confirmations: number }
  | { status: 'confirmed'; hash: Hash; receipt: TransactionReceipt }
  | { status: 'finalized'; hash: Hash; receipt: TransactionReceipt }
  | { status: 'failed'; hash: Hash; receipt: TransactionReceipt; reason: string }
  | { status: 'rejected'; reason: string }
  | { status: 'dropped'; hash: Hash }
  | { status: 'cancelled'; hash: Hash; cancelHash: Hash }

type TransactionEvent =
  | { type: 'SIGN'; tx: TransactionRequest }
  | { type: 'SIGNED'; hash: Hash }
  | { type: 'RECEIPT'; receipt: TransactionReceipt }
  | { type: 'CONFIRMATION'; count: number }
  | { type: 'FINALIZED' }
  | { type: 'FAIL'; reason: string }
  | { type: 'REJECT'; reason: string }
  | { type: 'DROP' }
  | { type: 'CANCEL'; cancelHash: Hash }

function transactionReducer(
  state: TransactionState,
  event: TransactionEvent,
): TransactionState {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SIGN') return { status: 'signing', tx: event.tx }
      if (event.type === 'REJECT') return { status: 'rejected', reason: event.reason }
      return state

    case 'signing':
      if (event.type === 'SIGNED') {
        return { status: 'pending', hash: event.hash, submittedAt: Date.now() }
      }
      if (event.type === 'REJECT') {
        return { status: 'rejected', reason: event.reason }
      }
      return state

    case 'pending':
      if (event.type === 'RECEIPT') {
        if (event.receipt.status === 'reverted') {
          return { status: 'failed', hash: state.hash, receipt: event.receipt, reason: 'reverted' }
        }
        return { status: 'confirming', hash: state.hash, receipt: event.receipt, confirmations: 0 }
      }
      if (event.type === 'DROP') {
        return { status: 'dropped', hash: state.hash }
      }
      if (event.type === 'CANCEL') {
        return { status: 'cancelled', hash: state.hash, cancelHash: event.cancelHash }
      }
      return state

    case 'confirming':
      if (event.type === 'CONFIRMATION') {
        return { ...state, confirmations: event.count }
      }
      if (event.type === 'FINALIZED') {
        return { status: 'finalized', hash: state.hash, receipt: state.receipt }
      }
      return state

    default:
      return state
  }
}
```

## 交易追蹤：receipt 輪詢 vs WebSocket 事件

兩種交易追蹤方式各有取捨：

**Receipt 輪詢**：簡單可靠，適用於所有 RPC 端點，但延遲較高。

**WebSocket 事件**：實時性好，但連接不穩定時容易丟失事件。

推薦策略是兩者結合：WebSocket 為主，輪詢為輔：

```typescript
class TransactionTracker {
  private wsClient: WebSocketClient | null = null
  private pollingTimers = new Map<Hash, NodeJS.Timeout>()
  private listeners = new Map<Hash, (state: TransactionState) => void>()

  constructor(
    private publicClient: PublicClient,
    private wsUrl?: string,
  ) {
    if (wsUrl) {
      this.wsClient = new WebSocketClient(wsUrl)
      this.setupWsListeners()
    }
  }

  track(hash: Hash, onUpdate: (state: TransactionState) => void) {
    this.listeners.set(hash, onUpdate)

    // 先輪詢獲取 receipt
    this.startPolling(hash)

    // 如果有 WebSocket，也訂閱
    if (this.wsClient) {
      this.subscribeToReceipt(hash)
    }
  }

  private startPolling(hash: Hash) {
    const poll = async () => {
      try {
        const receipt = await this.publicClient.getTransactionReceipt({ hash })

        if (receipt) {
          this.handleReceipt(hash, receipt)
          // 開始確認追蹤
          this.startConfirmationTracking(hash, receipt)
          this.pollingTimers.delete(hash)
          return
        }
      } catch (error) {
        // 靜默重試
      }

      // 繼續輪詢
      this.pollingTimers.set(hash, setTimeout(poll, 3000))
    }

    poll()
  }

  private startConfirmationTracking(hash: Hash, receipt: TransactionReceipt) {
    const pollConfirmations = async () => {
      const currentBlock = await this.publicClient.getBlockNumber()
      const confirmations = Number(currentBlock - receipt.blockNumber)

      const listener = this.listeners.get(hash)
      if (listener) {
        listener({ status: 'confirming', hash, receipt, confirmations })
      }

      // 檢查最終化
      const finalizedBlock = await this.publicClient.getBlock({ blockTag: 'finalized' })
      if (receipt.blockNumber <= finalizedBlock.number) {
        if (listener) {
          listener({ status: 'finalized', hash, receipt })
        }
        return
      }

      setTimeout(pollConfirmations, 5000)
    }

    pollConfirmations()
  }

  private setupWsListeners() {
    if (!this.wsClient) return

    this.wsClient.on('message', (msg) => {
      if (msg.method === 'eth_subscription' && msg.params?.result) {
        const hash = msg.params.result.transactionHash
        const listener = this.listeners.get(hash)
        if (listener) {
          // WebSocket 收到事件後，輪詢獲取完整 receipt
          this.startPolling(hash)
        }
      }
    })
  }

  private async subscribeToReceipt(hash: Hash) {
    // 訂閱 pending 交易
    await this.wsClient?.subscribe('alchemy_pendingTransactions', { toAddress: undefined })
  }

  private handleReceipt(hash: Hash, receipt: TransactionReceipt) {
    const listener = this.listeners.get(hash)
    if (!listener) return

    if (receipt.status === 'reverted') {
      listener({ status: 'failed', hash, receipt, reason: 'reverted' })
    } else {
      listener({ status: 'confirming', hash, receipt, confirmations: 0 })
    }
  }

  untrack(hash: Hash) {
    this.listeners.delete(hash)
    const timer = this.pollingTimers.get(hash)
    if (timer) {
      clearTimeout(timer)
      this.pollingTimers.delete(hash)
    }
  }
}
```

## 完整的交易狀態管理器

將狀態機、追蹤器和 UX 反饋整合：

```typescript
class TransactionManager {
  private state = $state<TransactionState>({ status: 'idle' })
  private tracker: TransactionTracker
  private notifications: NotificationService

  constructor(
    publicClient: PublicClient,
    notifications: NotificationService,
    wsUrl?: string,
  ) {
    this.tracker = new TransactionTracker(publicClient, wsUrl)
    this.notifications = notifications
  }

  async send(
    walletClient: WalletClient,
    tx: { to: Address; data?: `0x${string}`; value?: bigint },
    options?: { requiredConfirmations?: number },
  ) {
    this.dispatch({ type: 'SIGN', tx })

    try {
      const hash = await walletClient.sendTransaction(tx)
      this.dispatch({ type: 'SIGNED', hash })

      this.tracker.track(hash, (newState) => {
        this.state = newState

        // 發送通知
        this.handleNotifications(newState)

        // 執行業務回調
        this.handleCallbacks(newState, options)
      })
    } catch (error: any) {
      this.dispatch({ type: 'REJECT', reason: error.shortMessage || error.message })
    }
  }

  private dispatch(event: TransactionEvent) {
    this.state = transactionReducer(this.state, event)
  }

  private handleNotifications(state: TransactionState) {
    switch (state.status) {
      case 'pending':
        this.notifications.info('交易已提交，等待打包...')
        break
      case 'confirmed':
        this.notifications.success('交易已確認')
        break
      case 'failed':
        this.notifications.error(`交易失敗: ${state.reason}`)
        break
      case 'rejected':
        this.notifications.warning(`交易已拒絕: ${state.reason}`)
        break
    }
  }

  private handleCallbacks(
    state: TransactionState,
    options?: { requiredConfirmations?: number },
  ) {
    const required = options?.requiredConfirmations ?? 3
    if (state.status === 'confirming' && state.confirmations >= required) {
      // 執行成功回調
    }
    if (state.status === 'failed') {
      // 執行失敗回調
    }
  }
}
```

## UX 設計：進度展示、失敗重試、取消交易

**進度展示**：

```tsx
function TransactionStatus({ state }: { state: TransactionState }) {
  switch (state.status) {
    case 'signing':
      return <Spinner label="請在錢包中確認..." />

    case 'pending':
      return (
        <div>
          <Spinner label="交易打包中..." />
          <span>預計 {state.estimatedSeconds} 秒</span>
          <a href={getEtherscanUrl(state.hash)}>在瀏覽器中查看</a>
        </div>
      )

    case 'confirming':
      return (
        <div>
          <ProgressBar value={state.confirmations} max={required} />
          <span>確認中 {state.confirmations}/{required}</span>
        </div>
      )

    case 'failed':
      return (
        <div>
          <Alert type="error">交易失敗: {state.reason}</Alert>
          <Button onClick={retry}>重試</Button>
        </div>
      )
  }
}
```

**失敗重試**：

```typescript
async function retryTransaction(
  manager: TransactionManager,
  failedState: { status: 'failed'; hash: Hash; receipt: TransactionReceipt },
  walletClient: WalletClient,
) {
  // 獲取原始交易數據
  const originalTx = await publicClient.getTransaction({ hash: failedState.receipt.transactionHash })

  // 增加 Gas 限制
  const newGasLimit = (originalTx.gas * 130n) / 100n

  await manager.send(walletClient, {
    to: originalTx.to!,
    data: originalTx.input,
    value: originalTx.value,
  }, {
    gas: newGasLimit,
  })
}
```

**取消交易**：

```typescript
async function cancelTransaction(
  walletClient: WalletClient,
  pendingHash: Hash,
  publicClient: PublicClient,
) {
  // 獲取待處理交易的 nonce
  const tx = await publicClient.getTransaction({ hash: pendingHash })

  // 發送一筆相同 nonce、to=自己、value=0 的交易
  const cancelHash = await walletClient.sendTransaction({
    to: walletClient.account!.address,
    value: 0n,
    gas: 21000n,
    nonce: tx.nonce,
    // 設置更高的 Gas 價格以確保優先打包
    maxFeePerGas: (tx.gasPrice! * 110n) / 100n,
  })

  return cancelHash
}
```

## 多鏈交易的確認標準差異

不同鏈的確認標準差異巨大。前端應該維護一個鏈配置表，自動適配：

```typescript
const CHAIN_CONFIRMATION_STANDARDS: Record<number, {
  blockTime: number
  softConfirm: number
  finalBlock: number
  fastFinality: boolean
}> = {
  1:    { blockTime: 12, softConfirm: 3, finalBlock: 64, fastFinality: false },
  10:   { blockTime: 2, softConfirm: 1, finalBlock: 604800/2, fastFinality: false },
  137:  { blockTime: 2, softConfirm: 5, finalBlock: 512, fastFinality: false },
  42161:{ blockTime: 0.25, softConfirm: 1, finalBlock: 604800/0.25, fastFinality: false },
  8453: { blockTime: 2, softConfirm: 1, finalBlock: 604800/2, fastFinality: false },
  324:  { blockTime: 2, softConfirm: 1, finalBlock: 1800, fastFinality: true },
}
```

## 最佳實踐：交易通知系統設計

一個良好的交易通知系統應滿足：

- **多渠道通知**：Toast 通知 + 交易歷史記錄 + 可選的推送通知
- **狀態同步**：即使頁面刷新，交易狀態也能恢復
- **批量管理**：同時追蹤多筆交易，聚合展示
- **可取消**：pending 狀態的交易提供取消操作
- **可重試**：failed 狀態的交易提供一鍵重試

```typescript
// 將交易狀態持久化到 localStorage
function persistTransaction(hash: Hash, state: TransactionState) {
  const key = `tx:${hash}`
  const data = { state, timestamp: Date.now() }
  localStorage.setItem(key, JSON.stringify(data))
}

// 頁面加載時恢復未完成的交易
function restorePendingTransactions(): Hash[] {
  const pendingHashes: Hash[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!
    if (key.startsWith('tx:')) {
      const data = JSON.parse(localStorage.getItem(key)!)
      if (data.state.status === 'pending' || data.state.status === 'confirming') {
        pendingHashes.push(data.state.hash)
      }
    }
  }
  return pendingHashes
}
```

## 小結

Web3 交易狀態管理是 DApp 前端最核心也最複雜的部分。交易的異步性、多階段性和失敗可能性決定了前端必須採用嚴格的狀態機模型。從簽名到最終化，每個階段都需要明確的 UI 反饋。receipt 輪詢與 WebSocket 事件的混合追蹤策略兼顧了可靠性和實時性。多鏈環境下，確認標準差異要求前端具備鏈感知能力。將交易狀態持久化並在頁面刷新後恢復，是專業 DApp 的基本要求。交易通知系統的設計應以用戶信心為核心——讓用戶隨時知道他們的交易在什麼階段、是否安全、出了什麼問題。
