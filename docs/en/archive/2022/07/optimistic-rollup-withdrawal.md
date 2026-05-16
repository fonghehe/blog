---
title: "Optimistic Rollup Withdrawal Flow: Frontend Implementation"
date: 2022-07-11 15:05:35
tags:
  - Web3
  - Blockchain
readingTime: 11
description: "Optimistic Rollup's L2-to-L1 withdrawal involves a 7-day challenge period, which poses unique challenges for frontend state management and user experience. This article breaks down the complete withdrawal flow and provides a full frontend implementation solution."
wordCount: 2900
---

Optimistic Rollup (OR) is one of the mainstream Ethereum Layer 2 scaling solutions, with representative projects including Optimism (OVM) and Arbitrum (Nitro). Unlike zkRollup, OR adopts an "optimistic execution + fraud proof" security model, which directly causes L2 → L1 withdrawals to require a 7-day challenge period. For frontend developers, managing this 7-day asynchronous flow is a unique engineering challenge.

## Optimistic Rollup's Withdrawal Mechanism

### How the 7-Day Challenge Period Works

OR's core assumption is that all L2 transactions are valid by default, unless someone submits a fraud proof during the challenge period. L2 → L1 withdrawals essentially sync L2 state changes to L1, so they must wait for the challenge period to end before being confirmed on L1.

```
L2 initiate withdrawal → L2 exit transaction confirmed → wait 7 days → L1 finalize withdrawal
```

- **Optimism**: Challenge period is 7 days (approximately 604800 seconds)
- **Arbitrum**: Challenge period is approximately 7 days, depending on on-chain parameters

This 7-day waiting period is not a technical flaw, but an inevitable result of the security design. Shortening the challenge period means reducing the security margin and increasing the window for fraud attacks.

### Complete Steps of L2 → L1 Withdrawal

Taking Optimism as an example, the standard withdrawal flow includes the following steps:

1. **Initiate withdrawal on L2**: The user calls `withdraw` on L2 or initiates a withdrawal through a bridge contract
2. **L2 transaction confirmation**: Wait for L2 block confirmation (usually a few minutes)
3. **State root published to L1**: The sequencer submits the L2 state root to L1 (with a delay)
4. **Wait for challenge period**: 7-day fraud proof window
5. **Finalize on L1**: The user calls `finalizeWithdrawal` on L1 to complete the withdrawal

Arbitrum's flow is similar, but the interfaces and contract addresses are different.

## Frontend State Management

The complexity of the withdrawal flow lies in the fact that it is a multi-step asynchronous operation spanning two chains and lasting 7 days. The frontend needs to precisely manage the state of each phase.

### Withdrawal State Machine

```typescript
// types/withdrawal.ts
export enum WithdrawalStatus {
  // L2 phase
  PENDING_L2_CONFIRMATION = 'pending_l2_confirmation',
  L2_CONFIRMED = 'l2_confirmed',

  // Waiting period phase
  WAITING_FOR_CHALLENGE_PERIOD = 'waiting_challenge_period',
  CHALLENGE_PERIOD_ELAPSED = 'challenge_period_elapsed',

  // L1 phase
  READY_TO_FINALIZE = 'ready_to_finalize',
  FINALIZING = 'finalizing',
  FINALIZED = 'finalized',

  // Exception states
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

### State Management Hook

```typescript
// hooks/useWithdrawal.ts
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { WithdrawalStatus, WithdrawalRecord } from '../types/withdrawal'

const CHALLENGE_PERIOD_SECONDS = 7 * 24 * 60 * 60 // 7 days

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

  // Initiate L2 withdrawal
  const initiateWithdrawal = useCallback(
    async (amount: string, tokenAddress: string, l2Signer: ethers.Signer) => {
      setIsLoading(true)
      try {
        // Call the bridge contract on L2
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

  // Check if withdrawal can be finalized
  const checkFinalizable = useCallback(
    async (record: WithdrawalRecord): Promise<boolean> => {
      const now = Math.floor(Date.now() / 1000)

      // Check if challenge period has passed
      if (now < record.challengePeriodEndsAt) {
        return false
      }

      // Check if it can be finalized on L1
      // This requires calling the L2ToL1Message contract on L1
      return true
    },
    []
  )

  // Finalize withdrawal (last step on L1)
  const finalizeWithdrawal = useCallback(
    async (record: WithdrawalRecord): Promise<string> => {
      // Update status to finalizing
      updateWithdrawalStatus(record.id, WithdrawalStatus.FINALIZING)

      try {
        // Use @eth-optimism/sdk's CrossChainMessenger
        // Or directly call finalizeWithdrawal on L1
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

  // Poll to update withdrawal status
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
    }, 60_000) // Check every minute

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

## Simplifying Interactions with @eth-optimism/sdk

Optimism officially provides `@eth-optimism/sdk`, which encapsulates most of the cross-chain interaction logic:

```typescript
import { CrossChainMessenger, ETHBridgeAdapter } from '@eth-optimism/sdk'
import { ethers } from 'ethers'

// Initialize cross-chain messenger
const l1Provider = new ethers.providers.JsonRpcProvider(L1_RPC_URL)
const l2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL)
const l1Wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider)

const messenger = new CrossChainMessenger({
  l1ChainId: 1, // Ethereum mainnet
  l2ChainId: 10, // Optimism
  l1SignerOrProvider: l1Wallet,
  l2SignerOrProvider: l2Provider,
})

// Initiate withdrawal
async function withdrawETH(amount: string) {
  const tx = await messenger.withdrawETH(
    ethers.utils.parseEther(amount)
  )
  await tx.wait()

  // Get withdrawal messages
  const messages = await messenger.getWithdrawalMessages(
    tx.hash,
    0 // message index
  )

  return {
    l2TxHash: tx.hash,
    messages,
  }
}

// Check withdrawal status
async function getWithdrawalStatus(l2TxHash: string) {
  const status = await messenger.getMessageStatus(l2TxHash)
  // Status enum:
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

// Finalize withdrawal
async function finalizeWithdrawal(l2TxHash: string) {
  // Check if it can be finalized
  const status = await messenger.getMessageStatus(l2TxHash)
  if (status < 5) {
    throw new Error('Withdrawal not ready for relay')
  }

  // Prove first (if not yet proven)
  if (status === 3) {
    await messenger.proveMessage(l2TxHash)
  }

  // Wait for challenge period to pass, then relay
  const tx = await messenger.finalizeMessage(l2TxHash)
  await tx.wait()
  return tx.hash
}
```

## Transaction Tracking

### L2 Exit Transaction and L1 Finalize Transaction

Withdrawals involve two separate transactions on different chains:

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

  // Track L2 transaction
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

        // Listen for L1 finalize event
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

## Fast Bridge / Liquidity Bridge Frontend Adaptation

The 7-day waiting period is detrimental to user experience. As a result, various "fast bridge" solutions have emerged, using liquidity providers (LPs) to front funds and shorten withdrawal times.

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
  // Query quotes from multiple fast bridges
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

The frontend needs to simultaneously present both standard withdrawal (slow but cheaper) and fast bridge (fast but with fees) options, letting users weigh the trade-offs themselves.

## User Experience Design

### UX Handling for Long Waiting Periods

The 7-day waiting period needs to be clearly communicated in the UI:

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
        <h3>Withdrawal Completed</h3>
        <p>L1 Transaction: {record.l1TxHash}</p>
      </div>
    )
  }

  if (record.status === WithdrawalStatus.READY_TO_FINALIZE) {
    return (
      <div className="withdrawal-card ready">
        <h3>Withdrawal Ready to Finalize</h3>
        <p>The challenge period has ended. Click the button below to complete the withdrawal.</p>
        <button onClick={() => finalizeWithdrawal(record)}>
          Complete Withdrawal
        </button>
      </div>
    )
  }

  // Waiting for challenge period
  return (
    <div className="withdrawal-card waiting">
      <h3>Waiting for Challenge Period</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p>Approximately {remainingDays} days remaining</p>
      <p className="hint">
        This is Optimistic Rollup's security mechanism. The withdrawal can be finalized on L1 after 7 days.
      </p>
      <p className="l2-tx">L2 Transaction: {record.l2TxHash}</p>
    </div>
  )
}
```

### Status Polling and Event Listening Strategy

```typescript
// lib/withdrawalPoller.ts
export class WithdrawalPoller {
  private pollInterval = 60_000 // 1 minute
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

## Error Handling

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
      'L2 transaction was reverted. Please check your balance and approval.',
      error.transactionHash
    )
  }

  if (error.message?.includes('insufficient funds')) {
    return new WithdrawalError(
      WithdrawalErrorType.INSUFFICIENT_BALANCE,
      'Insufficient balance'
    )
  }

  if (error.message?.includes('Message not yet finalized')) {
    return new WithdrawalError(
      WithdrawalErrorType.FINALIZE_TOO_EARLY,
      'The withdrawal has not yet completed the challenge period. Please wait.'
    )
  }

  return new WithdrawalError(
    WithdrawalErrorType.L2_TRANSACTION_FAILED,
    error.message || 'Unknown error'
  )
}
```

## Comparison with zkRollup Withdrawal Flow

| Dimension | Optimistic Rollup | zkRollup |
|------|------------------|----------|
| Withdrawal time | ~7 days | Minutes to hours |
| Security model | Fraud proof | Validity proof |
| Frontend complexity | High (multi-step state machine) | Low (near-instant) |
| Fast bridge need | Strong demand | Weak demand |
| Finalize step | Requires manual user trigger | Automatic |

zkRollup (e.g., zkSync, StarkNet) uses mathematical proofs to guarantee the validity of L2 state, eliminating the need for a challenge period. From a frontend perspective, zkRollup's withdrawal experience is closer to native cross-chain transfers, with much simpler state management. However, OR solutions remain the mainstream choice due to simpler technical implementation and better EVM compatibility.

## Summary

The Optimistic Rollup withdrawal flow is one of the most complex interaction scenarios in Web3 frontend development. The 7-day challenge period turns a seemingly simple "transfer" operation into an asynchronous flow spanning two chains and lasting several days.

The core challenge lies in state management: the frontend needs to simultaneously track transaction states on both L2 and L1, manage time-based state transitions, and handle various exception cases. Using official SDKs (like `@eth-optimism/sdk`) can significantly simplify the complexity of cross-chain interactions, but state management and user experience still require substantial custom development.

Fast bridges (Across, Hop, Celer, etc.) solve the waiting period problem through liquidity fronting, but introduce additional trust assumptions and fees. The frontend should offer both standard withdrawal and fast bridge options, letting users choose based on their needs.

As the zkRollup ecosystem matures, OR withdrawal's 7-day waiting period is becoming an increasingly noticeable experience shortcoming. However, OR still has its advantages in EVM equivalence and developer ecosystem. Frontend developers need to be prepared to adapt to both solutions.
