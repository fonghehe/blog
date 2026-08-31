---
title: "Optimistic Rollup 提款流程前端实现"
date: 2022-07-11 15:05:35
tags:
  - Web3
  - Blockchain
readingTime: 9
description: "Optimistic Rollup 的 L2→L1 提款涉及 7 天挑战期，这对前端状态管理和用户体验提出了独特挑战。本文拆解提款全流程，给出完整的前端实现方案。"
wordCount: 1132
---

Optimistic Rollup（OR）是 Ethereum Layer 2 扩容的主流方案之一，代表项目包括 Optimism（OVM）和 Arbitrum（Nitro）。与 zkRollup 不同，OR 采用"乐观执行 + 欺诈证明"的安全模型，这直接导致了 L2 → L1 提款需要经历 7 天的挑战期。对于前端开发者而言，管理这个长达 7 天的异步流程是一个独特的工程挑战。

## Optimistic Rollup 的提款机制

### 7 天挑战期的工作原理

OR 的核心假设是：所有 L2 交易默认有效，除非有人在挑战期内提交欺诈证明。L2 → L1 的提款本质上是将 L2 的状态变化同步到 L1，因此必须等待挑战期结束才能在 L1 上确认。

```
L2 发起提款 → L2 exit 交易确认 → 等待 7 天 → L1 finalize 提款
```

- **Optimism**：挑战期为 7 天（约 604800 秒）
- **Arbitrum**：挑战期约 7 天，具体取决于链上参数

这个 7 天等待期不是技术缺陷，而是安全设计的必然结果。缩短挑战期意味着减少安全余量，增加欺诈攻击窗口。

### L2 → L1 提款的完整步骤

以 Optimism 为例，标准提款流程包括以下步骤：

1. **L2 上发起提款**：用户在 L2 上调用 `withdraw` 或通过桥合约发起提款
2. **L2 交易确认**：等待 L2 区块确认（通常几分钟）
3. **状态根发布到 L1**：排序器将 L2 状态根提交到 L1（有延迟）
4. **等待挑战期**：7 天的欺诈证明窗口
5. **L1 上 finalize**：用户在 L1 上调用 `finalizeWithdrawal` 完成提款

Arbitrum 的流程类似，但接口和合约地址不同。

## 前端状态管理

提款流程的复杂性在于它是一个跨越两条链、持续 7 天的多步骤异步操作。前端需要精确管理每个阶段的状态。

### 提款状态机

```typescript
// types/withdrawal.ts
export enum WithdrawalStatus {
  // L2 阶段
  PENDING_L2_CONFIRMATION = 'pending_l2_confirmation',
  L2_CONFIRMED = 'l2_confirmed',

  // 等待期阶段
  WAITING_FOR_CHALLENGE_PERIOD = 'waiting_challenge_period',
  CHALLENGE_PERIOD_ELAPSED = 'challenge_period_elapsed',

  // L1 阶段
  READY_TO_FINALIZE = 'ready_to_finalize',
  FINALIZING = 'finalizing',
  FINALIZED = 'finalized',

  // 异常状态
  FAILED = 'failed',
  CHALLENGED = 'challenged',
}

export interface WithdrawalRecord {
  id: string
  userId: string
  amount: string
  token: string
  l2TxHash: string
  l1TxHash?: string
  status: WithdrawalStatus
  initiatedAt: number
  challengePeriodEndsAt: number
  l2ToL1Message?: L2ToL1Message
}

export interface L2ToL1Message {
  from: string
  to: string
  l2Token: string
  l1Token: string
  amount: string
  data: string
}
```

### 状态管理 Hook

```typescript
// hooks/useWithdrawal.ts
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { WithdrawalStatus, WithdrawalRecord } from '../types/withdrawal'

const CHALLENGE_PERIOD_SECONDS = 7 * 24 * 60 * 60 // 7 天

interface UseWithdrawalParams {
  l2Provider: ethers.providers.Provider
  l1Provider: ethers.providers.Provider
  l1Signer: ethers.Signer
  l2BridgeAddress: string
}

export function useWithdrawal({
  l2Provider,
  l1Provider,
  l1Signer,
  l2BridgeAddress,
}: UseWithdrawalParams) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 发起 L2 提款
  const initiateWithdrawal = useCallback(
    async (amount: string, tokenAddress: string, l2Signer: ethers.Signer) => {
      setIsLoading(true)
      try {
        // 调用 L2 上的桥合约
        const bridge = new ethers.Contract(
          l2BridgeAddress,
          [
            'function withdrawTo(address _l2Token, address _to, uint256 _amount, uint32 _l1Gas, bytes _data) external',
          ],
          l2Signer
        )

        const recipient = await l1Signer.getAddress()
        const tx = await bridge.withdrawTo(
          tokenAddress,
          recipient,
          ethers.utils.parseEther(amount),
          0, // L1 gas limit
          '0x' // extra data
        )

        const receipt = await tx.wait()
        const block = await l2Provider.getBlock(receipt.blockNumber)

        const record: WithdrawalRecord = {
          id: receipt.transactionHash,
          userId: recipient,
          amount,
          token: tokenAddress,
          l2TxHash: receipt.transactionHash,
          status: WithdrawalStatus.L2_CONFIRMED,
          initiatedAt: block.timestamp,
          challengePeriodEndsAt:
            block.timestamp + CHALLENGE_PERIOD_SECONDS,
        }

        setWithdrawals((prev) => [...prev, record])
        return record
      } finally {
        setIsLoading(false)
      }
    },
    [l2BridgeAddress, l2Provider, l1Signer]
  )

  // 检查提款是否可以 finalize
  const checkFinalizable = useCallback(
    async (record: WithdrawalRecord): Promise<boolean> => {
      const now = Math.floor(Date.now() / 1000)

      // 检查挑战期是否已过
      if (now < record.challengePeriodEndsAt) {
        return false
      }

      // 检查 L1 上是否可以 finalize
      // 这里需要调用 L1 上的 L2ToL1Message 合约
      return true
    },
    []
  )

  // Finalize 提款（L1 上的最后一步）
  const finalizeWithdrawal = useCallback(
    async (record: WithdrawalRecord): Promise<string> => {
      // 更新状态为 finalizing
      updateWithdrawalStatus(record.id, WithdrawalStatus.FINALIZING)

      try {
        // 使用 @eth-optimism/sdk 的 CrossChainMessenger
        // 或者直接调用 L1 上的 finalizeWithdrawal
        const l1Bridge = new ethers.Contract(
          L1_BRIDGE_ADDRESS,
          [
            'function finalizeWithdrawal(bytes32 _l2TxHash) external',
          ],
          l1Signer
        )

        const tx = await l1Bridge.finalizeWithdrawal(record.l2TxHash)
        const receipt = await tx.wait()

        updateWithdrawalStatus(record.id, WithdrawalStatus.FINALIZED, {
          l1TxHash: receipt.transactionHash,
        })

        return receipt.transactionHash
      } catch (error) {
        updateWithdrawalStatus(record.id, WithdrawalStatus.FAILED)
        throw error
      }
    },
    [l1Signer]
  )

  const updateWithdrawalStatus = useCallback(
    (
      id: string,
      status: WithdrawalStatus,
      extra?: Partial<WithdrawalRecord>
    ) => {
      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, status, ...extra } : w
        )
      )
    },
    []
  )

  // 轮询更新提款状态
  useEffect(() => {
    const interval = setInterval(async () => {
      for (const w of withdrawals) {
        if (
          w.status === WithdrawalStatus.L2_CONFIRMED ||
          w.status === WithdrawalStatus.WAITING_FOR_CHALLENGE_PERIOD
        ) {
          const now = Math.floor(Date.now() / 1000)
          if (now >= w.challengePeriodEndsAt) {
            updateWithdrawalStatus(
              w.id,
              WithdrawalStatus.READY_TO_FINALIZE
            )
          } else {
            updateWithdrawalStatus(
              w.id,
              WithdrawalStatus.WAITING_FOR_CHALLENGE_PERIOD
            )
          }
        }
      }
    }, 60_000) // 每分钟检查一次

    return () => clearInterval(interval)
  }, [withdrawals, updateWithdrawalStatus])

  return {
    withdrawals,
    isLoading,
    initiateWithdrawal,
    finalizeWithdrawal,
    checkFinalizable,
  }
}
```

## 使用 @eth-optimism/sdk 简化交互

Optimism 官方提供了 `@eth-optimism/sdk`，封装了大部分跨链交互逻辑：

```typescript
import { CrossChainMessenger, ETHBridgeAdapter } from '@eth-optimism/sdk'
import { ethers } from 'ethers'

// 初始化跨链 messenger
const l1Provider = new ethers.providers.JsonRpcProvider(L1_RPC_URL)
const l2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL)
const l1Wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider)

const messenger = new CrossChainMessenger({
  l1ChainId: 1, // Ethereum mainnet
  l2ChainId: 10, // Optimism
  l1SignerOrProvider: l1Wallet,
  l2SignerOrProvider: l2Provider,
})

// 发起提款
async function withdrawETH(amount: string) {
  const tx = await messenger.withdrawETH(
    ethers.utils.parseEther(amount)
  )
  await tx.wait()

  // 获取提款消息
  const messages = await messenger.getWithdrawalMessages(
    tx.hash,
    0 // message index
  )

  return {
    l2TxHash: tx.hash,
    messages,
  }
}

// 检查提款状态
async function getWithdrawalStatus(l2TxHash: string) {
  const status = await messenger.getMessageStatus(l2TxHash)
  // 状态枚举：
  // 0: UNCONFIRMED_L1_TO_L2_MESSAGE
  // 1: FAILED_L1_TO_L2_MESSAGE
  // 2: STATE_ROOT_NOT_PUBLISHED
  // 3: READY_TO_PROVE
  // 4: IN_CHALLENGE_PERIOD
  // 5: READY_FOR_RELAY
  // 6: RELAYED
  // 7: RELAYED (expired)
  return status
}

// Finalize 提款
async function finalizeWithdrawal(l2TxHash: string) {
  // 检查是否可以 finalize
  const status = await messenger.getMessageStatus(l2TxHash)
  if (status < 5) {
    throw new Error('Withdrawal not ready for relay')
  }

  // 先 prove（如果还没有 prove 的话）
  if (status === 3) {
    await messenger.proveMessage(l2TxHash)
  }

  // 等待挑战期过后 relay
  const tx = await messenger.finalizeMessage(l2TxHash)
  await tx.wait()
  return tx.hash
}
```

## 交易追踪

### L2 exit 交易与 L1 finalize 交易

提款涉及两笔独立的交易，分别在不同的链上：

```typescript
// hooks/useWithdrawalTracking.ts
import { ethers } from 'ethers'

interface WithdrawalTracking {
  l2ExitTx: ethers.providers.TransactionReceipt | null
  l1FinalizeTx: ethers.providers.TransactionReceipt | null
  l2BlockTimestamp: number | null
  challengePeriodEndsAt: number | null
}

export function useWithdrawalTracking(
  l2TxHash: string | null,
  l2Provider: ethers.providers.Provider,
  l1Provider: ethers.providers.Provider,
  l1BridgeAddress: string
) {
  const [tracking, setTracking] = useState<WithdrawalTracking>({
    l2ExitTx: null,
    l1FinalizeTx: null,
    l2BlockTimestamp: null,
    challengePeriodEndsAt: null,
  })

  // 追踪 L2 交易
  useEffect(() => {
    if (!l2TxHash) return

    let cancelled = false

    async function trackL2() {
      try {
        const receipt = await l2Provider.waitForTransaction(l2TxHash!)
        if (cancelled) return

        const block = await l2Provider.getBlock(receipt.blockNumber)
        const challengeEnd =
          block.timestamp + 7 * 24 * 60 * 60

        setTracking((prev) => ({
          ...prev,
          l2ExitTx: receipt,
          l2BlockTimestamp: block.timestamp,
          challengePeriodEndsAt: challengeEnd,
        }))

        // 监听 L1 finalize 事件
        const l1Bridge = new ethers.Contract(
          l1BridgeAddress,
          [
            'event WithdrawalFinalized(bytes32 indexed l2TxHash, address indexed from, address indexed to, uint256 amount)',
          ],
          l1Provider
        )

        l1Bridge.on(
          'WithdrawalFinalized',
          (hash, from, to, amount, event) => {
            if (hash === l2TxHash) {
              setTracking((prev) => ({
                ...prev,
                l1FinalizeTx: event.transactionReceipt,
              }))
            }
          }
        )
      } catch (err) {
        console.error('L2 tracking failed:', err)
      }
    }

    trackL2()

    return () => {
      cancelled = true
    }
  }, [l2TxHash, l2Provider, l1Provider, l1BridgeAddress])

  return tracking
}
```

## Fast Bridge / Liquidity Bridge 的前端适配

7 天的等待期对于用户体验是致命的。因此出现了多种"快速桥"方案，通过流动性提供者（LP）预先垫付资金来缩短提款时间。

```typescript
// hooks/useFastBridge.ts
interface FastBridgeQuote {
  bridgeName: string
  amountReceived: string
  fee: string
  estimatedTimeMinutes: number
  available: boolean
}

async function getFastBridgeQuotes(
  amount: string,
  token: string,
  fromChain: number,
  toChain: number
): Promise<FastBridgeQuote[]> {
  // 查询多个快速桥的报价
  const bridges = [
    queryAcrossBridge(amount, token, fromChain, toChain),
    queryHopBridge(amount, token, fromChain, toChain),
    queryCelerBridge(amount, token, fromChain, toChain),
  ]

  const results = await Promise.allSettled(bridges)

  return results
    .filter(
      (r): r is PromiseFulfilledResult<FastBridgeQuote> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
}

async function queryAcrossBridge(
  amount: string,
  token: string,
  fromChain: number,
  toChain: number
): Promise<FastBridgeQuote> {
  const response = await fetch(
    `https://across.to/api/suggested-fees?token=${token}` +
      `&destinationChainId=${toChain}` +
      `&originChainId=${fromChain}` +
      `&amount=${amount}`
  )
  const data = await response.json()

  return {
    bridgeName: 'Across',
    amountReceived: data.relayFee.totalAmount,
    fee: data.relayFee.lpFee,
    estimatedTimeMinutes: 5,
    available: data.instantRelay,
  }
}
```

前端需要同时展示标准提款（慢但便宜）和快速桥（快但有手续费）两种选择，让用户自行权衡。

## 用户体验设计

### 长等待期的 UX 处理

7 天的等待期需要在 UI 上清晰传达：

```tsx
// components/WithdrawalStatus.tsx
import { WithdrawalStatus } from '../types/withdrawal'

function WithdrawalStatusCard({ record }: { record: WithdrawalRecord }) {
  const now = Math.floor(Date.now() / 1000)
  const remainingSeconds = Math.max(
    0,
    record.challengePeriodEndsAt - now
  )
  const remainingDays = Math.ceil(remainingSeconds / (24 * 60 * 60))
  const totalSeconds = 7 * 24 * 60 * 60
  const progress =
    ((totalSeconds - remainingSeconds) / totalSeconds) * 100

  if (record.status === WithdrawalStatus.FINALIZED) {
    return (
      <div className="withdrawal-card completed">
        <h3>提款已完成</h3>
        <p>L1 交易: {record.l1TxHash}</p>
      </div>
    )
  }

  if (record.status === WithdrawalStatus.READY_TO_FINALIZE) {
    return (
      <div className="withdrawal-card ready">
        <h3>提款可完成</h3>
        <p>挑战期已结束，点击下方按钮完成提款</p>
        <button onClick={() => finalizeWithdrawal(record)}>
          完成提款
        </button>
      </div>
    )
  }

  // 等待挑战期
  return (
    <div className="withdrawal-card waiting">
      <h3>等待挑战期</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p>剩余约 {remainingDays} 天</p>
      <p className="hint">
        这是 Optimistic Rollup 的安全机制，7 天后可在 L1 上完成提款
      </p>
      <p className="l2-tx">L2 交易: {record.l2TxHash}</p>
    </div>
  )
}
```

### 状态轮询与事件监听策略

```typescript
// lib/withdrawalPoller.ts
export class WithdrawalPoller {
  private pollInterval = 60_000 // 1 分钟
  private timers = new Map<string, NodeJS.Timeout>()

  startPolling(
    record: WithdrawalRecord,
    onUpdate: (record: WithdrawalRecord) => void
  ) {
    if (this.timers.has(record.id)) return

    const timer = setInterval(async () => {
      const updated = await this.checkStatus(record)
      if (updated.status !== record.status) {
        onUpdate(updated)
      }

      if (updated.status === WithdrawalStatus.FINALIZED) {
        this.stopPolling(updated.id)
      }
    }, this.pollInterval)

    this.timers.set(record.id, timer)
  }

  stopPolling(id: string) {
    const timer = this.timers.get(id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(id)
    }
  }

  private async checkStatus(
    record: WithdrawalRecord
  ): Promise<WithdrawalRecord> {
    const now = Math.floor(Date.now() / 1000)

    if (now >= record.challengePeriodEndsAt) {
      return { ...record, status: WithdrawalStatus.READY_TO_FINALIZE }
    }

    return { ...record, status: WithdrawalStatus.WAITING_FOR_CHALLENGE_PERIOD }
  }
}
```

## 错误处理

```typescript
// lib/errorHandling.ts
export enum WithdrawalErrorType {
  L2_TRANSACTION_FAILED = 'L2_TRANSACTION_FAILED',
  L2_TRANSACTION_REVERTED = 'L2_TRANSACTION_REVERTED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  FINALIZE_TOO_EARLY = 'FINALIZE_TOO_EARLY',
  FINALIZE_ALREADY_DONE = 'FINALIZE_ALREADY_DONE',
  L1_GAS_PRICE_TOO_HIGH = 'L1_GAS_PRICE_TOO_HIGH',
  CHALLENGE_DISPUTED = 'CHALLENGE_DISPUTED',
}

export class WithdrawalError extends Error {
  constructor(
    public type: WithdrawalErrorType,
    message: string,
    public txHash?: string
  ) {
    super(message)
  }
}

export function handleWithdrawalError(error: unknown): WithdrawalError {
  if (error.code === 'CALL_EXCEPTION') {
    return new WithdrawalError(
      WithdrawalErrorType.L2_TRANSACTION_REVERTED,
      'L2 交易被回滚，请检查余额和授权',
      error.transactionHash
    )
  }

  if (error.message?.includes('insufficient funds')) {
    return new WithdrawalError(
      WithdrawalErrorType.INSUFFICIENT_BALANCE,
      '余额不足'
    )
  }

  if (error.message?.includes('Message not yet finalized')) {
    return new WithdrawalError(
      WithdrawalErrorType.FINALIZE_TOO_EARLY,
      '提款尚未完成挑战期，请等待'
    )
  }

  return new WithdrawalError(
    WithdrawalErrorType.L2_TRANSACTION_FAILED,
    error.message || '未知错误'
  )
}
```

## 与 zkRollup 提款流程的对比

| 维度 | Optimistic Rollup | zkRollup |
|------|------------------|----------|
| 提款时间 | ~7 天 | 几分钟到几小时 |
| 安全模型 | 欺诈证明 | 有效性证明 |
| 前端复杂度 | 高（多步骤状态机） | 低（接近即时） |
| 快速桥需求 | 强需求 | 弱需求 |
| Finalize 步骤 | 需要用户手动触发 | 自动完成 |

zkRollup（如 zkSync、StarkNet）通过数学证明保证 L2 状态的有效性，不需要挑战期。从前端角度看，zkRollup 的提款体验更接近原生跨链转账，状态管理简单很多。但 OR 方案由于技术实现更简单、EVM 兼容性更好，仍是主流选择之一。

## 小结

Optimistic Rollup 的提款流程是 Web3 前端开发中最复杂的交互场景之一。7 天的挑战期把一个看似简单的"转账"操作变成了一个跨越两条链、持续数天的异步流程。

核心挑战在于状态管理：前端需要同时追踪 L2 和 L1 上的交易状态、管理时间相关的状态转换、处理各种异常情况。使用官方 SDK（如 `@eth-optimism/sdk`）可以显著简化跨链交互的复杂度，但状态管理和用户体验仍需大量定制开发。

快速桥（Across、Hop、Celer 等）通过流动性垫付解决了等待期问题，但引入了额外的信任假设和费用。前端应该同时提供标准提款和快速桥选项，让用户根据自身需求选择。

随着 zkRollup 生态的成熟，OR 提款的 7 天等待期正在成为越来越明显的体验短板。但在 EVM 等效性和开发者生态方面，OR 仍有其优势。前端开发者需要为两种方案都做好适配准备。
