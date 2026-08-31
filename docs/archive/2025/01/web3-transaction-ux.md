---
title: "Web3 交易状态管理与 UX 设计"
date: 2025-01-08 20:59:43
tags:
  - Web3
  - DApp
readingTime: 9
description: "系统性分析 Web3 交易生命周期的各阶段，提供完整的前端状态机设计与交易追踪方案"
wordCount: 1042
---

## Web3 交易生命周期的完整阶段

Web3 交易的生命周期远比 Web2 的 HTTP 请求复杂。一笔交易从用户签名到最终确认，需要经过多个异步阶段，每个阶段都可能失败。前端必须为每个阶段提供清晰的状态反馈。

一笔典型的以太坊交易经历以下阶段：

```
用户操作
   │
   ▼
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────┐
│  idle     │───▶│  signing │───▶│  pending     │───▶│ confirmed  │
│  (待操作) │    │  (签名中) │    │  (内存池中)   │    │  (已上链)   │
└──────────┘    └──────────┘    └──────────────┘    └────────────┘
                      │               │                     │
                      ▼               ▼                     ▼
                 ┌──────────┐  ┌──────────┐          ┌──────────┐
                 │ rejected │  │  failed  │          │  final   │
                 │ (用户拒绝)│  │ (执行失败)│          │ (最终化)  │
                 └──────────┘  └──────────┘          └──────────┘
                                    │
                              ┌─────┴─────┐
                              │           │
                          ┌───▼───┐  ┌───▼───┐
                          │ revert│  │ oog   │
                          │(逻辑失败)│ │(Gas不足)│
                          └───────┘  └───────┘
```

## pending 状态：交易提交到内存池

当用户签名后，交易被广播到内存池（mempool）。此时交易处于 pending 状态，等待矿工/验证者打包。

pending 阶段的不确定性最高。交易可能：

- **被快速打包**：Gas 价格合适时，通常在 1-2 个区块内打包
- **长时间等待**：Gas 价格偏低时，可能等待数小时
- **被替换**：用户可以通过 RBF（Replace-By-Fee）或取消交易来替换
- **被丢弃**：如果 Gas 价格过低，节点可能从 mempool 中丢弃交易

前端在 pending 阶段需要做的不仅是显示"等待中"，还应该展示预估等待时间和 Gas 价格：

```typescript
// 估算 pending 时间
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

  // 如果 maxFeePerGas < baseFee，交易不会被打包
  if (maxFeePerGas < baseFee) {
    return { estimatedBlocks: Infinity, estimatedSeconds: Infinity }
  }

  // 计算有效的 priority fee
  const effectivePriorityFee = maxFeePerGas - baseFee
  const recentPriorityFees = feeHistory.reward.flat()

  // 找到比当前 priority fee 低的交易占比
  const lowerCount = recentPriorityFees.filter(
    (fee) => fee < effectivePriorityFee,
  ).length
  const percentile = lowerCount / recentPriorityFees.length

  // 百分位越高，确认越快
  const estimatedBlocks = Math.max(1, Math.ceil(3 / percentile))
  const estimatedSeconds = estimatedBlocks * 12 // 以太坊出块时间

  return { estimatedBlocks, estimatedSeconds }
}
```

## confirmation：区块确认数与最终性

交易被打包进区块后，并不立即视为"最终确认"。不同场景需要不同的确认数：

- **小额交易**：1-3 个区块确认即可
- **大额交易**：12+ 个区块确认
- **跨链桥**：需要最终化（约 64 个区块，~12.8 分钟）
- **L2 交易**：通常 1 个区块即可（软确认），但提现需要 L1 最终化

```typescript
interface ConfirmationConfig {
  required: number        // 所需确认数
  final: number           // 最终化确认数
  label: (current: number) => string
}

function getConfirmationConfig(
  chainId: number,
  txValue: bigint,
): ConfirmationConfig {
  // 根据交易金额和链类型确定确认数
  if (txValue > parseEther('10')) {
    return {
      required: 12,
      final: 64,
      label: (c) => c >= 12 ? '安全确认' : `确认中 ${c}/12`,
    }
  }

  const chainConfigs: Record<number, ConfirmationConfig> = {
    1: { required: 3, final: 64, label: (c) => c >= 3 ? '已确认' : `确认中 ${c}/3` },
    10: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? '快速确认' : '确认中' },
    42161: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? '快速确认' : '确认中' },
  }

  return chainConfigs[chainId] ?? chainConfigs[1]
}
```

## failed：revert、out of gas、nonce 冲突

交易失败有三种主要原因，前端需要准确区分：

**1. Revert（逻辑失败）**

合约执行到 `require(false)` 或类似条件时触发。交易上链但状态回滚。前端需要解码 revert reason：

```typescript
async function decodeRevertReason(
  publicClient: PublicClient,
  txHash: Hash,
): Promise<string> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

  if (receipt.status === 'success') {
    return 'Transaction succeeded'
  }

  // 方式一：通过 trace 获取 revert reason
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
    // 方式二：重新模拟交易
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

交易的 Gas Limit 不足以完成执行。前端应在发送交易前准确估算 Gas：

```typescript
async function estimateGasWithBuffer(
  publicClient: PublicClient,
  tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
): Promise<bigint> {
  const estimated = await publicClient.estimateGas(tx)
  // 增加 20% 缓冲
  return (estimated * 120n) / 100n
}
```

**3. Nonce 冲突**

发送多笔交易时，如果 nonce 不连续，后续交易会卡在 pending 状态：

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

## 前端状态机设计

完整的交易状态机应该是一个有限状态自动机（FSM），每个状态有明确的转移条件：

```typescript
// 交易状态机
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

## 交易追踪：receipt 轮询 vs WebSocket 事件

两种交易追踪方式各有取舍：

**Receipt 轮询**：简单可靠，适用于所有 RPC 端点，但延迟较高。

**WebSocket 事件**：实时性好，但连接不稳定时容易丢失事件。

推荐策略是两者结合：WebSocket 为主，轮询为辅：

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

    // 先轮询获取 receipt
    this.startPolling(hash)

    // 如果有 WebSocket，也订阅
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
          // 开始确认追踪
          this.startConfirmationTracking(hash, receipt)
          this.pollingTimers.delete(hash)
          return
        }
      } catch (error) {
        // 静默重试
      }

      // 继续轮询
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

      // 检查最终化
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
          // WebSocket 收到事件后，轮询获取完整 receipt
          this.startPolling(hash)
        }
      }
    })
  }

  private async subscribeToReceipt(hash: Hash) {
    // 订阅 pending 交易
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

## 完整的交易状态管理器

将状态机、追踪器和 UX 反馈整合：

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

        // 发送通知
        this.handleNotifications(newState)

        // 执行业务回调
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
        this.notifications.success('交易已确认')
        break
      case 'failed':
        this.notifications.error(`交易失败: ${state.reason}`)
        break
      case 'rejected':
        this.notifications.warning(`交易已拒绝: ${state.reason}`)
        break
    }
  }

  private handleCallbacks(
    state: TransactionState,
    options?: { requiredConfirmations?: number },
  ) {
    const required = options?.requiredConfirmations ?? 3
    if (state.status === 'confirming' && state.confirmations >= required) {
      // 执行成功回调
    }
    if (state.status === 'failed') {
      // 执行失败回调
    }
  }
}
```

## UX 设计：进度展示、失败重试、取消交易

**进度展示**：

```tsx
function TransactionStatus({ state }: { state: TransactionState }) {
  switch (state.status) {
    case 'signing':
      return <Spinner label="请在钱包中确认..." />

    case 'pending':
      return (
        <div>
          <Spinner label="交易打包中..." />
          <span>预计 {state.estimatedSeconds} 秒</span>
          <a href={getEtherscanUrl(state.hash)}>在浏览器中查看</a>
        </div>
      )

    case 'confirming':
      return (
        <div>
          <ProgressBar value={state.confirmations} max={required} />
          <span>确认中 {state.confirmations}/{required}</span>
        </div>
      )

    case 'failed':
      return (
        <div>
          <Alert type="error">交易失败: {state.reason}</Alert>
          <Button onClick={retry}>重试</Button>
        </div>
      )
  }
}
```

**失败重试**：

```typescript
async function retryTransaction(
  manager: TransactionManager,
  failedState: { status: 'failed'; hash: Hash; receipt: TransactionReceipt },
  walletClient: WalletClient,
) {
  // 获取原始交易数据
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
  // 获取待处理交易的 nonce
  const tx = await publicClient.getTransaction({ hash: pendingHash })

  // 发送一笔相同 nonce、to=自己、value=0 的交易
  const cancelHash = await walletClient.sendTransaction({
    to: walletClient.account!.address,
    value: 0n,
    gas: 21000n,
    nonce: tx.nonce,
    // 设置更高的 Gas 价格以确保优先打包
    maxFeePerGas: (tx.gasPrice! * 110n) / 100n,
  })

  return cancelHash
}
```

## 多链交易的确认标准差异

不同链的确认标准差异巨大。前端应该维护一个链配置表，自动适配：

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

## 最佳实践：交易通知系统设计

一个良好的交易通知系统应满足：

- **多渠道通知**：Toast 通知 + 交易历史记录 + 可选的推送通知
- **状态同步**：即使页面刷新，交易状态也能恢复
- **批量管理**：同时追踪多笔交易，聚合展示
- **可取消**：pending 状态的交易提供取消操作
- **可重试**：failed 状态的交易提供一键重试

```typescript
// 将交易状态持久化到 localStorage
function persistTransaction(hash: Hash, state: TransactionState) {
  const key = `tx:${hash}`
  const data = { state, timestamp: Date.now() }
  localStorage.setItem(key, JSON.stringify(data))
}

// 页面加载时恢复未完成的交易
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

## 小结

Web3 交易状态管理是 DApp 前端最核心也最复杂的部分。交易的异步性、多阶段性和失败可能性决定了前端必须采用严格的状态机模型。从签名到最终化，每个阶段都需要明确的 UI 反馈。receipt 轮询与 WebSocket 事件的混合追踪策略兼顾了可靠性和实时性。多链环境下，确认标准差异要求前端具备链感知能力。将交易状态持久化并在页面刷新后恢复，是专业 DApp 的基本要求。交易通知系统的设计应以用户信心为核心——让用户随时知道他们的交易在什么阶段、是否安全、出了什么问题。
