---
title: "Optimistic Rollup の出金フローのフロントエンド実装"
date: 2022-07-11 15:05:35
tags:
  - Web3
  - Blockchain
readingTime: 11
description: "Optimistic Rollup の L2→L1 出金は 7 日間のチャレンジ期間を伴い、フロントエンドの状態管理とユーザー体験に独自の課題をもたらします。本記事では出金の全フローを分解し、完全なフロントエンド実装方案を提示します。"
wordCount: 1911
---

Optimistic Rollup（OR）は Ethereum Layer 2 スケーリングの主流方案の一つで、代表プロジェクトには Optimism（OVM）と Arbitrum（Nitro）があります。zkRollup とは異なり、OR は「楽観的実行 + フロードプルーフ」のセキュリティモデルを採用しており、これが L2 → L1 出金に 7 日間のチャレンジ期間が必要となる直接の原因です。フロントエンド開発者にとって、この 7 日間にわたる非同期フローの管理は独自のエンジニアリングチャレンジです。

## Optimistic Rollup の出金メカニズム

### 7 日間チャレンジ期間の仕組み

OR の核心的な仮定は：すべての L2 トランザクションはデフォルトで有効であり、チャレンジ期間中に誰かがフロードプルーフを提出しない限り例外です。L2 → L1 の出金は本質的に L2 の状態変化を L1 に同期することであるため、チャレンジ期間が終了するまで L1 で確認できません。

```
L2 で出金を開始 → L2 exit トランザクション確認 → 7 日間待機 → L1 finalize 出金
```

- **Optimism**：チャレンジ期間は 7 日間（約 604800 秒）
- **Arbitrum**：チャレンジ期間は約 7 日間、具体的にはオンチェーンパラメータに依存

この 7 日間の待機期間は技術的欠陥ではなく、セキュリティ設計の必然的な結果です。チャレンジ期間を短縮することはセキュリティマージンを減らし、フロード攻撃の窓を広げることを意味します。

### L2 → L1 出金の完全なステップ

Optimism を例にすると、標準的な出金フローには以下のステップが含まれます：

1. **L2 で出金を開始**：ユーザーが L2 で `withdraw` を呼び出すか、ブリッジコントラクトで出金を開始
2. **L2 トランザクション確認**：L2 ブロック確認を待機（通常数分）
3. **状態ルートが L1 に公開**：シーケンサーが L2 状態ルートを L1 に提出（遅延あり）
4. **チャレンジ期間の待機**：7 日間のフロードプルーフ窓
5. **L1 で finalize**：ユーザーが L1 で `finalizeWithdrawal` を呼び出して出金を完了

Arbitrum のフローも類似していますが、インターフェースとコントラクトアドレスが異なります。

## フロントエンド状態管理

出金フローの複雑さは、それが2つのチェーンにまたがり、7 日間継続するマルチステップ非同期操作である点にあります。フロントエンドは各段階の状態を正確に管理する必要があります。

### 出金状態マシン

```typescript
// types/withdrawal.ts
export enum WithdrawalStatus {
  // L2 段階
  PENDING_L2_CONFIRMATION = 'pending_l2_confirmation',
  L2_CONFIRMED = 'l2_confirmed',

  // 待機期間段階
  WAITING_FOR_CHALLENGE_PERIOD = 'waiting_challenge_period',
  CHALLENGE_PERIOD_ELAPSED = 'challenge_period_elapsed',

  // L1 段階
  READY_TO_FINALIZE = 'ready_to_finalize',
  FINALIZING = 'finalizing',
  FINALIZED = 'finalized',

  // 異常状態
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

### 状態管理 Hook

```typescript
// hooks/useWithdrawal.ts
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { WithdrawalStatus, WithdrawalRecord } from '../types/withdrawal'

const CHALLENGE_PERIOD_SECONDS = 7 * 24 * 60 * 60 // 7 日

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

  // L2 出金を開始
  const initiateWithdrawal = useCallback(
    async (amount: string, tokenAddress: string, l2Signer: ethers.Signer) => {
      setIsLoading(true)
      try {
        // L2 のブリッジコントラクトを呼び出し
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

  // 出金が finalize 可能かチェック
  const checkFinalizable = useCallback(
    async (record: WithdrawalRecord): Promise<boolean> => {
      const now = Math.floor(Date.now() / 1000)

      // チャレンジ期間が経過したかチェック
      if (now < record.challengePeriodEndsAt) {
        return false
      }

      // L1 で finalize 可能かチェック
      // ここで L1 の L2ToL1Message コントラクトを呼び出す必要がある
      return true
    },
    []
  )

  // Finalize 出金（L1 での最後のステップ）
  const finalizeWithdrawal = useCallback(
    async (record: WithdrawalRecord): Promise<string> => {
      // 状態を finalizing に更新
      updateWithdrawalStatus(record.id, WithdrawalStatus.FINALIZING)

      try {
        // @eth-optimism/sdk の CrossChainMessenger を使用
        // または L1 の finalizeWithdrawal を直接呼び出し
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

  // ポーリングで出金状態を更新
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
    }, 60_000) // 1 分ごとにチェック

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

## @eth-optimism/sdk によるインタラクションの簡素化

Optimism 公式は `@eth-optimism/sdk` を提供しており、クロスチェーンインタラクションロジックの大部分をカプセル化しています：

```typescript
import { CrossChainMessenger, ETHBridgeAdapter } from '@eth-optimism/sdk'
import { ethers } from 'ethers'

// クロスチェーン messenger の初期化
const l1Provider = new ethers.providers.JsonRpcProvider(L1_RPC_URL)
const l2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL)
const l1Wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider)

const messenger = new CrossChainMessenger({
  l1ChainId: 1, // Ethereum mainnet
  l2ChainId: 10, // Optimism
  l1SignerOrProvider: l1Wallet,
  l2SignerOrProvider: l2Provider,
})

// 出金の開始
async function withdrawETH(amount: string) {
  const tx = await messenger.withdrawETH(
    ethers.utils.parseEther(amount)
  )
  await tx.wait()

  // 出金メッセージの取得
  const messages = await messenger.getWithdrawalMessages(
    tx.hash,
    0 // message index
  )

  return {
    l2TxHash: tx.hash,
    messages,
  }
}

// 出金状態の確認
async function getWithdrawalStatus(l2TxHash: string) {
  const status = await messenger.getMessageStatus(l2TxHash)
  // 状態列挙：
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

// Finalize 出金
async function finalizeWithdrawal(l2TxHash: string) {
  // finalize 可能かチェック
  const status = await messenger.getMessageStatus(l2TxHash)
  if (status < 5) {
    throw new Error('Withdrawal not ready for relay')
  }

  // まず prove（まだ prove していない場合）
  if (status === 3) {
    await messenger.proveMessage(l2TxHash)
  }

  // チャレンジ期間経過後に relay
  const tx = await messenger.finalizeMessage(l2TxHash)
  await tx.wait()
  return tx.hash
}
```

## トランザクション追跡

### L2 exit トランザクションと L1 finalize トランザクション

出金は2つの独立したトランザクションを伴い、それぞれ異なるチェーン上にあります：

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

  // L2 トランザクションの追跡
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

        // L1 finalize イベントの監視
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

## Fast Bridge / Liquidity Bridge のフロントエンド適応

7 日間の待機期間はユーザー体験にとって致命的です。そのため、流動性プロバイダー（LP）が資金を先立てて出金時間を短縮する「ファストブリッジ」方案が複数登場しています。

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
  // 複数のファストブリッジの見積もりを照会
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

フロントエンドは標準出金（遅いが安い）とファストブリッジ（速いが手数料あり）の2つの選択肢を同時に提示し、ユーザー自身に判断させる必要があります。

## ユーザー体験デザイン

### 長期待機期間の UX 処理

7 日間の待機期間は UI 上で明確に伝える必要があります：

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
        <h3>出金が完了しました</h3>
        <p>L1 トランザクション: {record.l1TxHash}</p>
      </div>
    )
  }

  if (record.status === WithdrawalStatus.READY_TO_FINALIZE) {
    return (
      <div className="withdrawal-card ready">
        <h3>出金を完了できます</h3>
        <p>チャレンジ期間が終了しました。下のボタンをクリックして出金を完了してください</p>
        <button onClick={() => finalizeWithdrawal(record)}>
          出金を完了
        </button>
      </div>
    )
  }

  // チャレンジ期間の待機
  return (
    <div className="withdrawal-card waiting">
      <h3>チャレンジ期間待機中</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p>残り約 {remainingDays} 日</p>
      <p className="hint">
        これは Optimistic Rollup のセキュリティメカニズムです。7 日後に L1 で出金を完了できます
      </p>
      <p className="l2-tx">L2 トランザクション: {record.l2TxHash}</p>
    </div>
  )
}
```

### 状態ポーリングとイベント監視の戦略

```typescript
// lib/withdrawalPoller.ts
export class WithdrawalPoller {
  private pollInterval = 60_000 // 1 分
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

## エラー処理

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
      'L2 トランザクションがリバートされました。残高とアプローブを確認してください',
      error.transactionHash
    )
  }

  if (error.message?.includes('insufficient funds')) {
    return new WithdrawalError(
      WithdrawalErrorType.INSUFFICIENT_BALANCE,
      '残高不足'
    )
  }

  if (error.message?.includes('Message not yet finalized')) {
    return new WithdrawalError(
      WithdrawalErrorType.FINALIZE_TOO_EARLY,
      '出金はまだチャレンジ期間を完了していません。お待ちください'
    )
  }

  return new WithdrawalError(
    WithdrawalErrorType.L2_TRANSACTION_FAILED,
    error.message || '不明なエラー'
  )
}
```

## zkRollup 出金フローとの比較

| 次元 | Optimistic Rollup | zkRollup |
|------|------------------|----------|
| 出金時間 | ~7 日 | 数分から数時間 |
| セキュリティモデル | フロードプルーフ | 有効性証明 |
| フロントエンドの複雑さ | 高い（マルチステップ状態マシン） | 低い（ほぼ即時） |
| ファストブリッジの需要 | 強い需要 | 弱い需要 |
| Finalize ステップ | ユーザーの手動トリガーが必要 | 自動完了 |

zkRollup（zkSync、StarkNet など）は数学的証明で L2 状態の有効性を保証し、チャレンジ期間を必要としません。フロントエンドの観点から見ると、zkRollup の出金体験はネイティブクロスチェーン送金に近く、状態管理もはるかにシンプルです。しかし OR 方案は技術的実装がよりシンプルで EVM 互換性が高いため、2022年時点では依然として主流の選択でした。

## まとめ

Optimistic Rollup の出金フローは Web3 フロントエンド開発において最も複雑なインタラクションシナリオの一つです。7 日間のチャレンジ期間が、一見シンプルな「送金」操作を2つのチェーンにまたがり数日間継続する非同期フローに変えてしまいます。

核心的な課題は状態管理にあります：フロントエンドは L2 と L1 の両方のトランザクション状態を同時に追跡し、時間関連の状態遷移を管理し、各種異常状況を処理する必要があります。公式 SDK（`@eth-optimism/sdk` など）を使用することでクロスチェーンインタラクションの複雑さを大幅に軽減できますが、状態管理とユーザー体験には依然として大量のカスタム開発が必要です。

ファストブリッジ（Across、Hop、Celer など）は流動性の先立てによって待機期間の問題を解決しましたが、追加の信頼仮定と手数料を導入します。フロントエンドは標準出金とファストブリッジの両方の選択肢を提供し、ユーザーが自身のニーズに基づいて選択できるようにすべきです。

zkRollup エコシステムの成熟に伴い、OR 出金の 7 日間待機期間はますます顕著な体験上の弱点になりつつあります。しかし EVM 等価性と開発者エコシステムの面では、OR には依然として優位性があります。フロントエンド開発者は両方の方案への適応準備をしておく必要があります。
