---
title: "Optimistic Rollup 提款流程前端實現"
date: 2022-07-11 15:05:35
tags:
  - Web3
  - Blockchain
readingTime: 9
description: "Optimistic Rollup 的 L2→L1 提款涉及 7 天挑戰期，這對前端狀態管理和用戶體驗提出了獨特挑戰。本文拆解提款全流程，給出完整的前端實現方案。"
wordCount: 1136
---

Optimistic Rollup（OR）是 Ethereum Layer 2 擴容的主流方案之一，代表項目包括 Optimism（OVM）和 Arbitrum（Nitro）。與 zkRollup 不同，OR 採用"樂觀執行 + 欺詐證明"的安全模型，這直接導致了 L2 → L1 提款需要經歷 7 天的挑戰期。對於前端開發者而言，管理這個長達 7 天的異步流程是一個獨特的工程挑戰。

## Optimistic Rollup 的提款機制

### 7 天挑戰期的工作原理

OR 的核心假設是：所有 L2 交易默認有效，除非有人在挑戰期內提交欺詐證明。L2 → L1 的提款本質上是將 L2 的狀態變化同步到 L1，因此必須等待挑戰期結束才能在 L1 上確認。

```
L2 發起提款 → L2 exit 交易確認 → 等待 7 天 → L1 finalize 提款
```

- **Optimism**：挑戰期為 7 天（約 604800 秒）
- **Arbitrum**：挑戰期約 7 天，具體取決於鏈上參數

這個 7 天等待期不是技術缺陷，而是安全設計的必然結果。縮短挑戰期意味著減少安全餘量，增加欺詐攻擊窗口。

### L2 → L1 提款的完整步驟

以 Optimism 為例，標準提款流程包括以下步驟：

1. **L2 上發起提款**：用戶在 L2 上調用 `withdraw` 或通過橋合約發起提款
2. **L2 交易確認**：等待 L2 區塊確認（通常幾分鐘）
3. **狀態根發佈到 L1**：排序器將 L2 狀態根提交到 L1（有延遲）
4. **等待挑戰期**：7 天的欺詐證明窗口
5. **L1 上 finalize**：用戶在 L1 上調用 `finalizeWithdrawal` 完成提款

Arbitrum 的流程類似，但接口和合約地址不同。

## 前端狀態管理

提款流程的複雜性在於它是一個跨越兩條鏈、持續 7 天的多步驟異步操作。前端需要精確管理每個階段的狀態。

### 提款狀態機

```typescript
// types/withdrawal.ts
export enum WithdrawalStatus {
  // L2 階段
  PENDING_L2_CONFIRMATION = 'pending_l2_confirmation',
  L2_CONFIRMED = 'l2_confirmed',

  // 等待期階段
  WAITING_FOR_CHALLENGE_PERIOD = 'waiting_challenge_period',
  CHALLENGE_PERIOD_ELAPSED = 'challenge_period_elapsed',

  // L1 階段
  READY_TO_FINALIZE = 'ready_to_finalize',
  FINALIZING = 'finalizing',
  FINALIZED = 'finalized',

  // 異常狀態
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

### 狀態管理 Hook

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

  // 發起 L2 提款
  const initiateWithdrawal = useCallback(
    async (amount: string, tokenAddress: string, l2Signer: ethers.Signer) => {
      setIsLoading(true)
      try {
        // 調用 L2 上的橋合約
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

  // 檢查提款是否可以 finalize
  const checkFinalizable = useCallback(
    async (record: WithdrawalRecord): Promise<boolean> => {
      const now = Math.floor(Date.now() / 1000)

      // 檢查挑戰期是否已過
      if (now < record.challengePeriodEndsAt) {
        return false
      }

      // 檢查 L1 上是否可以 finalize
      // 這裡需要調用 L1 上的 L2ToL1Message 合約
      return true
    },
    []
  )

  // Finalize 提款（L1 上的最後一步）
  const finalizeWithdrawal = useCallback(
    async (record: WithdrawalRecord): Promise<string> => {
      // 更新狀態為 finalizing
      updateWithdrawalStatus(record.id, WithdrawalStatus.FINALIZING)

      try {
        // 使用 @eth-optimism/sdk 的 CrossChainMessenger
        // 或者直接調用 L1 上的 finalizeWithdrawal
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

  // 輪詢更新提款狀態
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
    }, 60_000) // 每分鐘檢查一次

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

## 使用 @eth-optimism/sdk 簡化交互

Optimism 官方提供了 `@eth-optimism/sdk`，封裝了大部分跨鏈交互邏輯：

```typescript
import { CrossChainMessenger, ETHBridgeAdapter } from '@eth-optimism/sdk'
import { ethers } from 'ethers'

// 初始化跨鏈 messenger
const l1Provider = new ethers.providers.JsonRpcProvider(L1_RPC_URL)
const l2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL)
const l1Wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider)

const messenger = new CrossChainMessenger({
  l1ChainId: 1, // Ethereum mainnet
  l2ChainId: 10, // Optimism
  l1SignerOrProvider: l1Wallet,
  l2SignerOrProvider: l2Provider,
})

// 發起提款
async function withdrawETH(amount: string) {
  const tx = await messenger.withdrawETH(
    ethers.utils.parseEther(amount)
  )
  await tx.wait()

  // 獲取提款消息
  const messages = await messenger.getWithdrawalMessages(
    tx.hash,
    0 // message index
  )

  return {
    l2TxHash: tx.hash,
    messages,
  }
}

// 檢查提款狀態
async function getWithdrawalStatus(l2TxHash: string) {
  const status = await messenger.getMessageStatus(l2TxHash)
  // 狀態枚舉：
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
  // 檢查是否可以 finalize
  const status = await messenger.getMessageStatus(l2TxHash)
  if (status < 5) {
    throw new Error('Withdrawal not ready for relay')
  }

  // 先 prove（如果還沒有 prove 的話）
  if (status === 3) {
    await messenger.proveMessage(l2TxHash)
  }

  // 等待挑戰期過後 relay
  const tx = await messenger.finalizeMessage(l2TxHash)
  await tx.wait()
  return tx.hash
}
```

## 交易追蹤

### L2 exit 交易與 L1 finalize 交易

提款涉及兩筆獨立的交易，分別在不同的鏈上：

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

  // 追蹤 L2 交易
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

        // 監聽 L1 finalize 事件
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

## Fast Bridge / Liquidity Bridge 的前端適配

7 天的等待期對於用戶體驗是致命的。因此出現了多種"快速橋"方案，通過流動性提供者（LP）預先墊付資金來縮短提款時間。

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
  // 查詢多個快速橋的報價
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

前端需要同時展示標準提款（慢但便宜）和快速橋（快但有手續費）兩種選擇，讓用戶自行權衡。

## 用戶體驗設計

### 長等待期的 UX 處理

7 天的等待期需要在 UI 上清晰傳達：

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
        <p>挑戰期已結束，點擊下方按鈕完成提款</p>
        <button onClick={() => finalizeWithdrawal(record)}>
          完成提款
        </button>
      </div>
    )
  }

  // 等待挑戰期
  return (
    <div className="withdrawal-card waiting">
      <h3>等待挑戰期</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p>剩餘約 {remainingDays} 天</p>
      <p className="hint">
        這是 Optimistic Rollup 的安全機制，7 天后可在 L1 上完成提款
      </p>
      <p className="l2-tx">L2 交易: {record.l2TxHash}</p>
    </div>
  )
}
```

### 狀態輪詢與事件監聽策略

```typescript
// lib/withdrawalPoller.ts
export class WithdrawalPoller {
  private pollInterval = 60_000 // 1 分鐘
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

## 錯誤處理

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
      'L2 交易被回滾，請檢查餘額和授權',
      error.transactionHash
    )
  }

  if (error.message?.includes('insufficient funds')) {
    return new WithdrawalError(
      WithdrawalErrorType.INSUFFICIENT_BALANCE,
      '餘額不足'
    )
  }

  if (error.message?.includes('Message not yet finalized')) {
    return new WithdrawalError(
      WithdrawalErrorType.FINALIZE_TOO_EARLY,
      '提款尚未完成挑戰期，請等待'
    )
  }

  return new WithdrawalError(
    WithdrawalErrorType.L2_TRANSACTION_FAILED,
    error.message || '未知錯誤'
  )
}
```

## 與 zkRollup 提款流程的對比

| 維度 | Optimistic Rollup | zkRollup |
|------|------------------|----------|
| 提款時間 | ~7 天 | 幾分鐘到幾小時 |
| 安全模型 | 欺詐證明 | 有效性證明 |
| 前端複雜度 | 高（多步驟狀態機） | 低（接近即時） |
| 快速橋需求 | 強需求 | 弱需求 |
| Finalize 步驟 | 需要用戶手動觸發 | 自動完成 |

zkRollup（如 zkSync、StarkNet）通過數學證明保證 L2 狀態的有效性，不需要挑戰期。從前端角度看，zkRollup 的提款體驗更接近原生跨鏈轉賬，狀態管理簡單很多。但 OR 方案由於技術實現更簡單、EVM 兼容性更好，仍然是許多項目的主流選擇。

## 小結

Optimistic Rollup 的提款流程是 Web3 前端開發中最複雜的交互場景之一。7 天的挑戰期把一個看似簡單的"轉賬"操作變成了一個跨越兩條鏈、持續數天的異步流程。

核心挑戰在於狀態管理：前端需要同時追蹤 L2 和 L1 上的交易狀態、管理時間相關的狀態轉換、處理各種異常情況。使用官方 SDK（如 `@eth-optimism/sdk`）可以顯著簡化跨鏈交互的複雜度，但狀態管理和用戶體驗仍需大量定製開發。

快速橋（Across、Hop、Celer 等）通過流動性墊付解決了等待期問題，但引入了額外的信任假設和費用。前端應該同時提供標準提款和快速橋選項，讓用戶根據自身需求選擇。

隨著 zkRollup 生態的成熟，OR 提款的 7 天等待期正在成為越來越明顯的體驗短板。但在 EVM 等效性和開發者生態方面，OR 仍有其優勢。前端開發者需要為兩種方案都做好適配準備。
