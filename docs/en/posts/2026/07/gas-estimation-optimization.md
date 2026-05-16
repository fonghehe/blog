---
title: "Gas Estimation and Optimization: Frontend Gas Management Practices"
date: 2026-07-20 16:24:17
tags:
  - Web3
  - Ethereum
  - 性能优化
readingTime: 7
description: "Deep dive into EIP-1559 gas mechanics, frontend gas estimation APIs, batch transaction optimization, and L2 gas estimation differences"
wordCount: 3200
---

## Gas Mechanism Review: EIP-1559's Base Fee + Priority Fee

EIP-1559 reshaped Ethereum's fee market. Each transaction's cost consists of two parts:

- **base fee**: Dynamically adjusted by the protocol based on block congestion; burned rather than paid to miners
- **priority fee (tip)**: A voluntary tip paid to validators that influences transaction inclusion priority

Transactions control gas price through two parameters:

- `maxFeePerGas`: The maximum gas price the user is willing to pay (cap on base fee + priority fee)
- `maxPriorityFeePerGas`: The priority fee the user is willing to pay

Actual payment: `min(maxFeePerGas, baseFee + maxPriorityFeePerGas)`

When the base fee rises, if `maxFeePerGas` is high enough, the transaction can still be included—the priority fee automatically decreases. This mechanism means the frontend doesn't need to predict gas prices precisely; it only needs to set reasonable caps.

## Frontend Gas Estimation APIs: eth_estimateGas, eth_feeHistory

Ethereum provides two core APIs for gas estimation:

```typescript
import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// 1. eth_estimateGas — Estimate the gas limit needed for a transaction
async function estimateGasLimit(
  from: Address,
  to: Address,
  data: `0x${string}` = '0x',
  value: bigint = 0n,
): Promise<bigint> {
  try {
    const gas = await publicClient.estimateGas({
      account: from,
      to,
      data,
      value,
    })
    // Add 20% buffer to avoid edge cases
    return (gas * 120n) / 100n
  } catch (error) {
    // Estimation failure usually means the transaction will revert
    throw new GasEstimationError(
      'Gas estimation failed. Transaction may revert.',
      error,
    )
  }
}

// 2. eth_feeHistory — Get historical gas price distribution
async function getGasPriceDistribution(
  blockCount: number = 20,
  rewardPercentiles: number[] = [10, 50, 90],
) {
  const feeHistory = await publicClient.getFeeHistory({
    blockCount,
    rewardPercentiles,
  })

  const baseFees = feeHistory.baseFeePerGas
  const gasUsedRatios = feeHistory.gasUsedRatio

  // Calculate priority fee distribution for recent blocks
  const rewards = feeHistory.reward || []
  const p10 = rewards.map((r) => r[0]).filter(Boolean)
  const p50 = rewards.map((r) => r[1]).filter(Boolean)
  const p90 = rewards.map((r) => r[2]).filter(Boolean)

  return {
    currentBaseFee: baseFees[baseFees.length - 1],
    nextBaseFee: baseFees[baseFees.length - 1], // Estimated base fee for next block
    avgPriorityFee: {
      low: p10.length ? p10.reduce((a, b) => a + b, 0n) / BigInt(p10.length) : 0n,
      medium: p50.length ? p50.reduce((a, b) => a + b, 0n) / BigInt(p50.length) : 0n,
      high: p90.length ? p90.reduce((a, b) => a + b, 0n) / BigInt(p90.length) : 0n,
    },
    congestionLevel: this.calculateCongestion(gasUsedRatio),
  }
}
```

## Calculating maxFeePerGas and maxPriorityFeePerGas

A reasonable gas price calculation strategy needs to balance confirmation speed and cost:

```typescript
type SpeedPreference = 'slow' | 'standard' | 'fast' | 'instant'

interface GasPriceSuggestion {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  estimatedSeconds: number
  estimatedCost: (gasLimit: bigint) => bigint
}

async function suggestGasPrice(
  publicClient: PublicClient,
  speed: SpeedPreference = 'standard',
): Promise<GasPriceSuggestion> {
  const [block, feeHistory] = await Promise.all([
    publicClient.getBlock(),
    publicClient.getFeeHistory({
      blockCount: 20,
      rewardPercentiles: [10, 25, 50, 75, 90],
    }),
  ])

  const baseFee = block.baseFeePerGas!
  const rewards = feeHistory.reward || []

  // Select priority fee based on speed preference
  const percentileMap: Record<SpeedPreference, number> = {
    slow: 10,
    standard: 50,
    fast: 75,
    instant: 90,
  }

  const percentile = percentileMap[speed]
  const priorityFees = rewards.map((r) => r[percentileMap[speed]]).filter(Boolean)

  const avgPriorityFee = priorityFees.length > 0
    ? priorityFees.reduce((a, b) => a + b, 0n) / BigInt(priorityFees.length)
    : 1_000_000_000n // Default 1 gwei

  // maxFeePerGas = baseFee * 2 + priorityFee (2x buffer for base fee volatility)
  const maxFeePerGas = baseFee * 2n + avgPriorityFee
  const maxPriorityFeePerGas = avgPriorityFee

  // Estimate confirmation time
  const estimatedBlocks: Record<SpeedPreference, number> = {
    slow: 5,
    standard: 3,
    fast: 2,
    instant: 1,
  }
  const estimatedSeconds = estimatedBlocks[speed] * 12

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
    estimatedSeconds,
    estimatedCost: (gasLimit: bigint) => gasLimit * maxFeePerGas,
  }
}
```

## Causes and Handling of Estimation Failures

Gas estimation failure is a common frontend issue. Common causes and solutions:

```typescript
class GasEstimationErrorHandler {
  // Classify and handle estimation failures
  async handleEstimationError(
    error: unknown,
    publicClient: PublicClient,
    tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
  ): Promise<GasEstimationResult> {
    // Cause 1: Transaction will revert
    const revertReason = await this.tryGetRevertReason(publicClient, tx)
    if (revertReason) {
      return {
        success: false,
        reason: 'revert',
        message: revertReason,
        suggestion: 'Check contract conditions and parameters',
      }
    }

    // Cause 2: Out of Gas (insufficient gas limit)
    const code = await this.estimateGasWithHighLimit(publicClient, tx)
    if (code) {
      return {
        success: false,
        reason: 'out_of_gas',
        message: 'Insufficient gas for transaction',
        suggestion: 'Increase gas limit',
      }
    }

    // Cause 3: Nonce conflict
    const nonce = await publicClient.getTransactionCount({
      address: tx.from,
      blockTag: 'pending',
    })
    const pendingTxs = await this.getPendingTransactions(tx.from)
    if (pendingTxs.length > 0) {
      return {
        success: false,
        reason: 'nonce_conflict',
        message: 'Pending transactions are blocking',
        suggestion: 'Wait for pending transactions or speed them up',
      }
    }

    // Cause 4: RPC node issues
    return {
      success: false,
      reason: 'rpc_error',
      message: 'RPC node temporarily unavailable',
      suggestion: 'Switch RPC node and retry',
    }
  }

  private async tryGetRevertReason(
    publicClient: PublicClient,
    tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
  ): Promise<string | null> {
    try {
      await publicClient.simulate({
        account: tx.from,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })
      return null
    } catch (error: any) {
      return error.shortMessage || error.message
    }
  }
}
```

## Gas Optimization Strategy: Batch Transactions (Multicall)

Multicall is one of the most effective gas optimization techniques. It combines multiple contract calls into a single transaction:

```typescript
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem'
import { mainnet } from 'viem/chains'

// Multicall address (Ethereum mainnet)
const MULTICALL3_ADDRESS = '0xcA11bde05977b363116702886EbE2E56Ab8d6F2E' as Address

class BatchTransactionBuilder {
  private publicClient: PublicClient

  constructor(rpcUrl: string) {
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }

  // Batch read (aggregate3)
  async batchRead(
    calls: { target: Address; callData: `0x${string}` }[],
  ): Promise<`0x${string}`[]> {
    const results = await this.publicClient.readContract({
      address: MULTICALL3_ADDRESS,
      abi: multicall3Abi,
      functionName: 'aggregate3',
      args: [calls.map((c) => ({ target: c.target, callData: c.callData, allowFailure: false }))],
    })

    return results.map((r) => r.returnData)
  }

  // Batch write (combine multiple operations into one transaction)
  buildBatchWrite(
    walletClient: WalletClient,
    calls: { target: Address; callData: `0x${string}`; value?: bigint }[],
  ) {
    // Method: Use Multicall3's aggregate3Value (supports sending ETH)
    const multicallData = encodeFunctionData({
      abi: multicall3Abi,
      functionName: 'aggregate3Value',
      args: [
        calls.map((c) => ({
          target: c.target,
          callData: c.callData,
          value: c.value || 0n,
          allowFailure: false,
        })),
      ],
    })

    const totalValue = calls.reduce((sum, c) => sum + (c.value || 0n), 0n)

    return {
      to: MULTICALL3_ADDRESS,
      data: multicallData,
      value: totalValue,
    }
  }

  // Practical use: approve + swap + stake in one transaction
  async buildDeFiCombo(
    walletClient: WalletClient,
    params: {
      tokenIn: Address
      tokenOut: Address
      amountIn: bigint
      minAmountOut: bigint
      router: Address
      staking: Address
    },
  ) {
    const calls = [
      // 1. Approve Router
      {
        target: params.tokenIn,
        callData: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [params.router, params.amountIn],
        }),
      },
      // 2. Swap
      {
        target: params.router,
        callData: encodeFunctionData({
          abi: routerAbi,
          functionName: 'swapExactTokensForTokens',
          args: [params.amountIn, params.minAmountOut, [params.tokenIn, params.tokenOut], MULTICALL3_ADDRESS],
        }),
      },
      // 3. Approve Staking
      {
        target: params.tokenOut,
        callData: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [params.staking, params.minAmountOut],
        }),
      },
      // 4. Stake
      {
        target: params.staking,
        callData: encodeFunctionData({
          abi: stakingAbi,
          functionName: 'stake',
          args: [params.minAmountOut],
        }),
      },
    ]

    const batchTx = this.buildBatchWrite(walletClient, calls)

    // Estimate gas
    const gasLimit = await this.publicClient.estimateGas({
      account: walletClient.account!.address,
      to: batchTx.to!,
      data: batchTx.data,
      value: batchTx.value,
    })

    return {
      ...batchTx,
      gasLimit: (gasLimit * 120n) / 100n,
    }
  }
}
```

**Gas savings quantification**: 4 separate transactions require approximately 4 × 21,000 (base) + 4 × contract execution gas. By merging via Multicall, only 1 × 21,000 + 4 × contract execution gas is needed, saving approximately 63,000 gas.

## Contract-Level Gas Optimization Impact on Frontend

Contract optimizations directly affect frontend gas estimation and user experience:

- **Storage optimization**: Using `uint128` instead of `uint256` can pack multiple variables into one slot
- **Batch operations**: Contract-provided batch functions are more efficient than frontend multicall
- **Events vs storage**: Using events instead of storage for read-only data saves significant gas
- **Proxy patterns**: Proxy contract's delegatecall costs ~2,000 more gas than call

The frontend should be aware of contract-level optimizations. For example, if the contract provides a `batchTransfer` function, the frontend should prefer it over calling `transfer` multiple times via multicall.

## Complete Gas Estimation and Management Module

```typescript
class GasManager {
  private publicClient: PublicClient
  private priceCache: { price: GasPriceSuggestion; timestamp: number } | null = null
  private cacheTTL = 10000 // 10-second cache

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient
  }

  // Get gas price (with cache)
  async getGasPrice(speed: SpeedPreference = 'standard'): Promise<GasPriceSuggestion> {
    if (this.priceCache && Date.now() - this.priceCache.timestamp < this.cacheTTL) {
      return this.priceCache.price
    }

    const price = await suggestGasPrice(this.publicClient, speed)
    this.priceCache = { price, timestamp: Date.now() }
    return price
  }

  // Complete transaction gas estimation
  async estimateTransaction(tx: {
    from: Address
    to: Address
    data?: `0x${string}`
    value?: bigint
  }, speed: SpeedPreference = 'standard'): Promise<TransactionGasEstimate> {
    const [gasLimit, gasPrice] = await Promise.all([
      this.estimateGasWithFallback(tx),
      this.getGasPrice(speed),
    ])

    const gasCost = gasLimit * gasPrice.maxFeePerGas
    const gasCostEth = formatEther(gasCost)
    const gasCostUsd = await this.convertToUsd(gasCost)

    return {
      gasLimit,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      estimatedCostWei: gasCost,
      estimatedCostEth: gasCostEth,
      estimatedCostUsd: gasCostUsd,
      estimatedSeconds: gasPrice.estimatedSeconds,
    }
  }

  // Gas estimation with fallback
  private async estimateGasWithFallback(tx: {
    from: Address
    to: Address
    data?: `0x${string}`
    value?: bigint
  }): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas(tx)
      return (gas * 120n) / 100n // 20% buffer
    } catch {
      // Fall back to fixed gas limit
      return this.getFallbackGasLimit(tx.data)
    }
  }

  // Estimate gas based on call data size
  private getFallbackGasLimit(data?: `0x${string}`): bigint {
    if (!data || data === '0x') {
      return 21000n // Simple transfer
    }
    // Contract call base + data gas
    const dataSize = (data.length - 2) / 2
    return 30000n + BigInt(dataSize * 16)
  }

  private async convertToUsd(wei: bigint): Promise<number> {
    // Get ETH/USD price from Chainlink
    const ethUsd = await this.getEthUsdPrice()
    return Number(formatEther(wei)) * ethUsd
  }

  private async getEthUsdPrice(): Promise<number> {
    const price = await this.publicClient.readContract({
      address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // Chainlink ETH/USD
      abi: chainlinkAbi,
      functionName: 'latestAnswer',
    })
    return Number(price) / 1e8
  }
}

interface TransactionGasEstimate {
  gasLimit: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  estimatedCostWei: bigint
  estimatedCostEth: string
  estimatedCostUsd: number
  estimatedSeconds: number
}
```

## Gas Prediction UI: Displaying Estimated Costs Before Signing

A good gas UI should show complete cost information before the user signs:

```tsx
function GasEstimationPanel({ estimate, onChange }: {
  estimate: TransactionGasEstimate
  onChange: (speed: SpeedPreference) => void
}) {
  const [speed, setSpeed] = useState<SpeedPreference>('standard')

  return (
    <div className="gas-panel">
      <div className="gas-speed-selector">
        {(['slow', 'standard', 'fast', 'instant'] as const).map((s) => (
          <button
            key={s}
            className={speed === s ? 'active' : ''}
            onClick={() => { setSpeed(s); onChange(s) }}
          >
            <span className="label">{SPEED_LABELS[s]}</span>
            <span className="time">~{estimate.estimatedSeconds}s</span>
          </button>
        ))}
      </div>

      <div className="gas-breakdown">
        <div className="row">
          <span>Gas Limit</span>
          <span>{Number(estimate.gasLimit).toLocaleString()}</span>
        </div>
        <div className="row">
          <span>Base Fee</span>
          <span>{formatGwei(estimate.maxFeePerGas - estimate.maxPriorityFeePerGas)} Gwei</span>
        </div>
        <div className="row">
          <span>Priority Fee</span>
          <span>{formatGwei(estimate.maxPriorityFeePerGas)} Gwei</span>
        </div>
        <div className="row total">
          <span>Estimated Total Cost</span>
          <span>
            {estimate.estimatedCostEth} ETH
            <span className="usd">(~${estimate.estimatedCostUsd.toFixed(2)})</span>
          </span>
        </div>
      </div>
    </div>
  )
}
```

## L2 Gas Estimation Differences

L2 gas mechanisms differ significantly from L1, and the frontend must adapt:

```typescript
interface L2GasEstimator {
  chainId: number
  estimateGas: (tx: TransactionRequest) => Promise<{
    gasLimit: bigint
    l1DataGas: bigint   // L1 data publication cost (unique to L2)
    l2ExecutionGas: bigint
    totalCost: bigint
  }>
}

// Optimism Gas Estimation
class OptimismGasEstimator implements L2GasEstimator {
  chainId = 10

  async estimateGas(tx: TransactionRequest) {
    const l2Gas = await this.publicClient.estimateGas(tx)

    // Optimism's L1 data cost
    const rlptx = encodeRlp(tx)
    const l1DataGas = await this.publicClient.request({
      method: 'eth_getL1GasUsed',
      params: [{ data: rlptx }],
    })

    const l1GasCost = BigInt(l1DataGas) * await this.getL1BaseFee()
    const l2GasCost = l2Gas * await this.getL2BaseFee()

    return {
      gasLimit: l2Gas,
      l1DataGas: BigInt(l1DataGas),
      l2ExecutionGas: l2Gas,
      totalCost: l1GasCost + l2GasCost,
    }
  }
}

// Arbitrum Gas Estimation
class ArbitrumGasEstimator implements L2GasEstimator {
  chainId = 42161

  async estimateGas(tx: TransactionRequest) {
    // Arbitrum reports detailed gas breakdown via ArbOS
    const result = await this.publicClient.request({
      method: 'eth_estimateGas',
      params: [tx],
    })

    // Arbitrum's gas price includes both L1 and L2 portions
    const gasPrice = await this.publicClient.getGasPrice()

    return {
      gasLimit: BigInt(result),
      l1DataGas: 0n, // Arbitrum handles this internally
      l2ExecutionGas: BigInt(result),
      totalCost: BigInt(result) * gasPrice,
    }
  }
}
```

## Best Practices: Gas Fee Monitoring and Alerts

```typescript
class GasMonitor {
  private threshold: bigint
  private interval: NodeJS.Timeout | null = null
  private callbacks: Set<(alert: GasAlert) => void> = new Set()

  constructor(private publicClient: PublicClient, thresholdGwei: number) {
    this.threshold = BigInt(thresholdGwei) * 1_000_000_000n
  }

  start(intervalMs: number = 60000) {
    this.interval = setInterval(async () => {
      const price = await this.publicClient.getGasPrice()
      if (price < this.threshold) {
        this.callbacks.forEach((cb) => cb({
          currentPrice: price,
          threshold: this.threshold,
          suggestion: 'Gas price below threshold, suitable for sending transactions',
        }))
      }
    }, intervalMs)
  }

  onLowGas(cb: (alert: GasAlert) => void) {
    this.callbacks.add(cb)
  }

  stop() {
    if (this.interval) clearInterval(this.interval)
  }
}
```

## Summary

Gas management is a core experience component of Web3 frontends. EIP-1559's dual-fee model makes gas estimation more predictable, but the frontend still needs to correctly calculate `maxFeePerGas` and `maxPriorityFeePerGas`. Handling estimation failures requires classification—revert, out of gas, and nonce conflict each require different strategies. Multicall is the most effective gas optimization technique, significantly reducing batch operation costs. L2 gas mechanisms differ significantly from L1—Optimism has L1 data costs, Arbitrum has internal gas conversion, and the frontend must adapt with chain awareness. Gas prediction UI should show a complete cost breakdown before signing, giving users clear expectations. Gas monitoring and alert systems can help users send transactions during low-gas periods, optimizing transaction costs.
