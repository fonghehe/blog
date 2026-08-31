---
title: "Web3 Transaction State Management and UX Design"
date: 2025-01-08 20:59:43
tags:
  - Web3
  - DApp
readingTime: 9
description: "A systematic analysis of each stage in the Web3 transaction lifecycle, providing a complete frontend state machine design and transaction tracking solution"
wordCount: 655
---

## Complete Stages of the Web3 Transaction Lifecycle

The lifecycle of a Web3 transaction is far more complex than a Web2 HTTP request. A transaction goes through multiple asynchronous stages from user signing to final confirmation, and each stage can fail. The frontend must provide clear status feedback for each stage.

A typical Ethereum transaction goes through the following stages:

```
User Action
   │
   ▼
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────┐
│  idle     │───▶│  signing │───▶│  pending     │───▶│ confirmed  │
│  (idle)   │    │ (signing)│    │ (in mempool) │    │ (on-chain) │
└──────────┘    └──────────┘    └──────────────┘    └────────────┘
                      │               │                     │
                      ▼               ▼                     ▼
                 ┌──────────┐  ┌──────────┐          ┌──────────┐
                 │ rejected │  │  failed  │          │  final   │
                 │ (user rejected)│  │(execution failed)│  │ (finalized)│
                 └──────────┘  └──────────┘          └──────────┘
                                    │
                              ┌─────┴─────┐
                              │           │
                          ┌───▼───┐  ┌───▼───┐
                          │ revert│  │ oog   │
                          │(logic │ │(out of│
                          │failed)│ │ gas)  │
                          └───────┘  └───────┘
```

## Pending State: Transaction Submitted to Mempool

After the user signs, the transaction is broadcast to the mempool. At this point, the transaction is in a pending state, waiting for miners/validators to include it in a block.

The pending stage has the highest uncertainty. The transaction may:

- **Be quickly included**: When the gas price is appropriate, usually within 1-2 blocks
- **Wait for a long time**: When the gas price is too low, it may wait for hours
- **Be replaced**: The user can replace it via RBF (Replace-By-Fee) or cancel the transaction
- **Be dropped**: If the gas price is too low, nodes may drop the transaction from the mempool

During the pending stage, the frontend should do more than just show "waiting" — it should also display estimated wait time and gas price:

```typescript
// Estimate pending time
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

  // If maxFeePerGas < baseFee, the transaction won't be included
  if (maxFeePerGas < baseFee) {
    return { estimatedBlocks: Infinity, estimatedSeconds: Infinity }
  }

  // Calculate effective priority fee
  const effectivePriorityFee = maxFeePerGas - baseFee
  const recentPriorityFees = feeHistory.reward.flat()

  // Find the percentage of transactions with lower priority fee than current
  const lowerCount = recentPriorityFees.filter(
    (fee) => fee < effectivePriorityFee,
  ).length
  const percentile = lowerCount / recentPriorityFees.length

  // Higher percentile = faster confirmation
  const estimatedBlocks = Math.max(1, Math.ceil(3 / percentile))
  const estimatedSeconds = estimatedBlocks * 12 // Ethereum block time

  return { estimatedBlocks, estimatedSeconds }
}
```

## Confirmation: Block Confirmations and Finality

After a transaction is included in a block, it is not immediately considered "finally confirmed." Different scenarios require different numbers of confirmations:

- **Small transactions**: 1-3 block confirmations are sufficient
- **Large transactions**: 12+ block confirmations
- **Cross-chain bridges**: Require finality (about 64 blocks, ~12.8 minutes)
- **L2 transactions**: Usually 1 block is sufficient (soft confirmation), but withdrawals require L1 finality

```typescript
interface ConfirmationConfig {
  required: number        // Required confirmations
  final: number           // Finalization confirmations
  label: (current: number) => string
}

function getConfirmationConfig(
  chainId: number,
  txValue: bigint,
): ConfirmationConfig {
  // Determine confirmations based on transaction amount and chain type
  if (txValue > parseEther('10')) {
    return {
      required: 12,
      final: 64,
      label: (c) => c >= 12 ? 'Securely confirmed' : `Confirming ${c}/12`,
    }
  }

  const chainConfigs: Record<number, ConfirmationConfig> = {
    1: { required: 3, final: 64, label: (c) => c >= 3 ? 'Confirmed' : `Confirming ${c}/3` },
    10: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? 'Fast confirmation' : 'Confirming' },
    42161: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? 'Fast confirmation' : 'Confirming' },
  }

  return chainConfigs[chainId] ?? chainConfigs[1]
}
```

## Failed: Revert, Out of Gas, Nonce Conflict

There are three main reasons for transaction failure, and the frontend needs to accurately distinguish them:

**1. Revert (Logic Failure)**

Triggered when contract execution hits `require(false)` or similar conditions. The transaction is included on-chain but the state is rolled back. The frontend needs to decode the revert reason:

```typescript
async function decodeRevertReason(
  publicClient: PublicClient,
  txHash: Hash,
): Promise<string> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

  if (receipt.status === 'success') {
    return 'Transaction succeeded'
  }

  // Method 1: Get revert reason via trace
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
    // Method 2: Re-simulate the transaction
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

The transaction's gas limit is insufficient to complete execution. The frontend should accurately estimate gas before sending the transaction:

```typescript
async function estimateGasWithBuffer(
  publicClient: PublicClient,
  tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
): Promise<bigint> {
  const estimated = await publicClient.estimateGas(tx)
  // Add 20% buffer
  return (estimated * 120n) / 100n
}
```

**3. Nonce Conflict**

When sending multiple transactions, if nonces are not sequential, subsequent transactions will be stuck in pending state:

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

## Frontend State Machine Design

A complete transaction state machine should be a finite state machine (FSM) where each state has clear transition conditions:

```typescript
// Transaction state machine
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

## Transaction Tracking: Receipt Polling vs WebSocket Events

Two transaction tracking approaches each have trade-offs:

**Receipt polling**: Simple and reliable, works with all RPC endpoints, but has higher latency.

**WebSocket events**: Better real-time performance, but events can be lost when the connection is unstable.

The recommended strategy is to combine both: WebSocket as primary, polling as fallback:

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

    // First poll for receipt
    this.startPolling(hash)

    // If WebSocket is available, also subscribe
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
          // Start confirmation tracking
          this.startConfirmationTracking(hash, receipt)
          this.pollingTimers.delete(hash)
          return
        }
      } catch (error) {
        // Silent retry
      }

      // Continue polling
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

      // Check finalization
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
          // After WebSocket receives event, poll for complete receipt
          this.startPolling(hash)
        }
      }
    })
  }

  private async subscribeToReceipt(hash: Hash) {
    // Subscribe to pending transactions
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

## Complete Transaction Status Manager

Integrating the state machine, tracker, and UX feedback:

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

        // Send notifications
        this.handleNotifications(newState)

        // Execute business callbacks
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
        this.notifications.info('Transaction submitted, waiting to be included...')
        break
      case 'confirmed':
        this.notifications.success('Transaction confirmed')
        break
      case 'failed':
        this.notifications.error(`Transaction failed: ${state.reason}`)
        break
      case 'rejected':
        this.notifications.warning(`Transaction rejected: ${state.reason}`)
        break
    }
  }

  private handleCallbacks(
    state: TransactionState,
    options?: { requiredConfirmations?: number },
  ) {
    const required = options?.requiredConfirmations ?? 3
    if (state.status === 'confirming' && state.confirmations >= required) {
      // Execute success callback
    }
    if (state.status === 'failed') {
      // Execute failure callback
    }
  }
}
```

## UX Design: Progress Display, Failure Retry, Transaction Cancellation

**Progress Display**:

```tsx
function TransactionStatus({ state }: { state: TransactionState }) {
  switch (state.status) {
    case 'signing':
      return <Spinner label="Please confirm in your wallet..." />

    case 'pending':
      return (
        <div>
          <Spinner label="Transaction being included..." />
          <span>Estimated {state.estimatedSeconds} seconds</span>
          <a href={getEtherscanUrl(state.hash)}>View on explorer</a>
        </div>
      )

    case 'confirming':
      return (
        <div>
          <ProgressBar value={state.confirmations} max={required} />
          <span>Confirming {state.confirmations}/{required}</span>
        </div>
      )

    case 'failed':
      return (
        <div>
          <Alert type="error">Transaction failed: {state.reason}</Alert>
          <Button onClick={retry}>Retry</Button>
        </div>
      )
  }
}
```

**Failure Retry**:

```typescript
async function retryTransaction(
  manager: TransactionManager,
  failedState: { status: 'failed'; hash: Hash; receipt: TransactionReceipt },
  walletClient: WalletClient,
) {
  // Get original transaction data
  const originalTx = await publicClient.getTransaction({ hash: failedState.receipt.transactionHash })

  // Increase gas limit
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

**Transaction Cancellation**:

```typescript
async function cancelTransaction(
  walletClient: WalletClient,
  pendingHash: Hash,
  publicClient: PublicClient,
) {
  // Get the pending transaction's nonce
  const tx = await publicClient.getTransaction({ hash: pendingHash })

  // Send a transaction with the same nonce, to=self, value=0
  const cancelHash = await walletClient.sendTransaction({
    to: walletClient.account!.address,
    value: 0n,
    gas: 21000n,
    nonce: tx.nonce,
    // Set higher gas price to ensure priority inclusion
    maxFeePerGas: (tx.gasPrice! * 110n) / 100n,
  })

  return cancelHash
}
```

## Confirmation Standard Differences Across Chains

Confirmation standards vary greatly across chains. The frontend should maintain a chain configuration table for automatic adaptation:

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

## Best Practices: Transaction Notification System Design

A good transaction notification system should satisfy:

- **Multi-channel notifications**: Toast notifications + transaction history + optional push notifications
- **State synchronization**: Transaction state can be restored even after page refresh
- **Batch management**: Track multiple transactions simultaneously with aggregated display
- **Cancellable**: Pending transactions provide cancel operations
- **Retryable**: Failed transactions provide one-click retry

```typescript
// Persist transaction state to localStorage
function persistTransaction(hash: Hash, state: TransactionState) {
  const key = `tx:${hash}`
  const data = { state, timestamp: Date.now() }
  localStorage.setItem(key, JSON.stringify(data))
}

// Restore incomplete transactions on page load
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

## Summary

Web3 transaction state management is the most critical and complex part of DApp frontends. The asynchronous nature, multi-stage process, and failure potential of transactions dictate that the frontend must adopt a strict state machine model. From signing to finalization, each stage requires clear UI feedback. The hybrid tracking strategy of receipt polling and WebSocket events balances reliability and real-time performance. In multi-chain environments, confirmation standard differences require the frontend to be chain-aware. Persisting transaction state and restoring it after page refresh is a basic requirement for professional DApps. The design of the transaction notification system should be centered on user confidence — letting users know at all times what stage their transaction is in, whether it's safe, and what went wrong.
