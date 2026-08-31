---
title: "Gas 估算與最佳化：前端 Gas 管理實踐"
date: 2026-07-20 16:24:17
tags:
  - Web3
  - Ethereum
  - 性能优化
readingTime: 8
description: "深入解析 EIP-1559 Gas 機制、前端 Gas 估算 API、批次交易最佳化策略及 L2 Gas 估算差異"
wordCount: 813
---

## Gas 機制解析：EIP-1559 的 base fee + priority fee

EIP-1559 重塑了以太坊的費用市場。每筆交易的費用由兩部分組成：

- **base fee**：由協議根據區塊擁堵程度動態調整，被燃燒而非支付給礦工
- **priority fee（tip）**：使用者自願支付給驗證者的小費，影響交易打包優先級

交易透過兩個參數控制 Gas 價格：

- `maxFeePerGas`：使用者願意支付的最高 Gas 價格（base fee + priority fee 的上限）
- `maxPriorityFeePerGas`：使用者願意支付的 priority fee

實際支付：`min(maxFeePerGas, baseFee + maxPriorityFeePerGas)`

當 base fee 上漲時，如果 `maxFeePerGas` 足夠高，交易仍能被打包，priority fee 會自動降低。這種機制使前端無需精確預測 Gas 價格，只需設定合理的上限。

## 前端 Gas 估算 API：eth_estimateGas, eth_feeHistory

以太坊提供了兩個核心 API 用於 Gas 估算：

```typescript
import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// 1. eth_estimateGas — 估算交易所需的 Gas Limit
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
    // 增加 20% 緩衝，避免邊緣情況
    return (gas * 120n) / 100n
  } catch (error) {
    // 估算失敗通常意味著交易會 revert
    throw new GasEstimationError(
      'Gas estimation failed. Transaction may revert.',
      error,
    )
  }
}

// 2. eth_feeHistory — 取得歷史 Gas 價格分布
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

  // 計算最近區塊的 priority fee 分布
  const rewards = feeHistory.reward || []
  const p10 = rewards.map((r) => r[0]).filter(Boolean)
  const p50 = rewards.map((r) => r[1]).filter(Boolean)
  const p90 = rewards.map((r) => r[2]).filter(Boolean)

  return {
    currentBaseFee: baseFees[baseFees.length - 1],
    nextBaseFee: baseFees[baseFees.length - 1], // 下一區塊的預估 base fee
    avgPriorityFee: {
      low: p10.length ? p10.reduce((a, b) => a + b, 0n) / BigInt(p10.length) : 0n,
      medium: p50.length ? p50.reduce((a, b) => a + b, 0n) / BigInt(p50.length) : 0n,
      high: p90.length ? p90.reduce((a, b) => a + b, 0n) / BigInt(p90.length) : 0n,
    },
    congestionLevel: this.calculateCongestion(gasUsedRatio),
  }
}
```

## maxFeePerGas 與 maxPriorityFeePerGas 的計算

合理的 Gas 價格計算策略需要平衡確認速度和費用成本：

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

  // 根據速度偏好選擇 priority fee
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
    : 1_000_000_000n // 預設 1 gwei

  // maxFeePerGas = baseFee * 2 + priorityFee（2 倍緩衝應對 base fee 波動）
  const maxFeePerGas = baseFee * 2n + avgPriorityFee
  const maxPriorityFeePerGas = avgPriorityFee

  // 估算確認時間
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

## 估算失敗的原因與處理

Gas 估算失敗是前端常見問題，常見原因和解決方案：

```typescript
class GasEstimationErrorHandler {
  // 分類處理估算失敗
  async handleEstimationError(
    error: unknown,
    publicClient: PublicClient,
    tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
  ): Promise<GasEstimationResult> {
    // 原因 1：交易會 revert
    const revertReason = await this.tryGetRevertReason(publicClient, tx)
    if (revertReason) {
      return {
        success: false,
        reason: 'revert',
        message: revertReason,
        suggestion: '請檢查合約條件和參數',
      }
    }

    // 原因 2：Out of Gas（Gas Limit 不夠）
    const code = await this.estimateGasWithHighLimit(publicClient, tx)
    if (code) {
      return {
        success: false,
        reason: 'out_of_gas',
        message: '交易 Gas 不足',
        suggestion: '增加 Gas Limit',
      }
    }

    // 原因 3：Nonce 衝突
    const nonce = await publicClient.getTransactionCount({
      address: tx.from,
      blockTag: 'pending',
    })
    const pendingTxs = await this.getPendingTransactions(tx.from)
    if (pendingTxs.length > 0) {
      return {
        success: false,
        reason: 'nonce_conflict',
        message: '有待處理交易阻塞',
        suggestion: '等待待處理交易完成或加速',
      }
    }

    // 原因 4：RPC 節點問題
    return {
      success: false,
      reason: 'rpc_error',
      message: 'RPC 節點暫時不可用',
      suggestion: '切換 RPC 節點重試',
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

## Gas 最佳化策略：批次交易（multicall）

Multicall 是最有效的 Gas 最佳化手段之一。它將多個合約呼叫合併為一筆交易：

```typescript
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem'
import { mainnet } from 'viem/chains'

// Multicall 位址（Ethereum mainnet）
const MULTICALL3_ADDRESS = '0xcA11bde05977b363116702886EbE2E56Ab8d6F2E' as Address

class BatchTransactionBuilder {
  private publicClient: PublicClient

  constructor(rpcUrl: string) {
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }

  // 批次讀取（aggregate3）
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

  // 批次寫入（將多個操作合併為一筆交易）
  buildBatchWrite(
    walletClient: WalletClient,
    calls: { target: Address; callData: `0x${string}`; value?: bigint }[],
  ) {
    // 方式一：使用 Multicall3 的 aggregate3Value（支援發送 ETH）
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

  // 實際使用：一次性 approve + swap + stake
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

    // 估算 Gas
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

**Gas 節省量化**：4 筆獨立交易約需 4 × 21,000（基礎）+ 4 × 合約執行 Gas。透過 Multicall 合併，只需 1 × 21,000 + 4 × 合約執行 Gas，節省約 63,000 Gas。

## 合約層面的 Gas 最佳化對前端的影響

合約最佳化直接影響前端的 Gas 估算和使用者體驗：

- **儲存最佳化**：使用 `uint128` 而非 `uint256` 可以打包多個變數到一個 slot
- **批次操作**：合約提供的批次函式比前端 multicall 更高效
- **事件 vs 儲存**：唯讀資料用事件而非儲存可以節省大量 Gas
- **代理模式**：代理合約的 delegatecall 比 call 多消耗約 2,000 Gas

前端應感知合約層面的最佳化。例如，如果合約提供了 `batchTransfer` 函式，前端應優先使用而非透過 multicall 呼叫多次 `transfer`。

## 完整的 Gas 估算與管理模組

```typescript
class GasManager {
  private publicClient: PublicClient
  private priceCache: { price: GasPriceSuggestion; timestamp: number } | null = null
  private cacheTTL = 10000 // 10 秒快取

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient
  }

  // 取得 Gas 價格（帶快取）
  async getGasPrice(speed: SpeedPreference = 'standard'): Promise<GasPriceSuggestion> {
    if (this.priceCache && Date.now() - this.priceCache.timestamp < this.cacheTTL) {
      return this.priceCache.price
    }

    const price = await suggestGasPrice(this.publicClient, speed)
    this.priceCache = { price, timestamp: Date.now() }
    return price
  }

  // 完整的交易 Gas 估算
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

  // 帶回退的 Gas 估算
  private async estimateGasWithFallback(tx: {
    from: Address
    to: Address
    data?: `0x${string}`
    value?: bigint
  }): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas(tx)
      return (gas * 120n) / 100n // 20% 緩衝
    } catch {
      // 回退到固定 Gas Limit
      return this.getFallbackGasLimit(tx.data)
    }
  }

  // 根據呼叫資料大小估算 Gas
  private getFallbackGasLimit(data?: `0x${string}`): bigint {
    if (!data || data === '0x') {
      return 21000n // 簡單轉帳
    }
    // 合約呼叫基礎 + 資料 Gas
    const dataSize = (data.length - 2) / 2
    return 30000n + BigInt(dataSize * 16)
  }

  private async convertToUsd(wei: bigint): Promise<number> {
    // 從 Chainlink 取得 ETH/USD 價格
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

## Gas 預測 UI：交易前展示預估費用

良好的 Gas UI 應在使用者簽名前展示完整費用資訊：

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
          <span>預估總費用</span>
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

## L2 Gas 估算的差異

L2 的 Gas 機制與 L1 有顯著差異，前端必須適配：

```typescript
interface L2GasEstimator {
  chainId: number
  estimateGas: (tx: TransactionRequest) => Promise<{
    gasLimit: bigint
    l1DataGas: bigint   // L1 資料發布成本（L2 特有）
    l2ExecutionGas: bigint
    totalCost: bigint
  }>
}

// Optimism Gas 估算
class OptimismGasEstimator implements L2GasEstimator {
  chainId = 10

  async estimateGas(tx: TransactionRequest) {
    const l2Gas = await this.publicClient.estimateGas(tx)

    // Optimism 的 L1 資料成本
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

// Arbitrum Gas 估算
class ArbitrumGasEstimator implements L2GasEstimator {
  chainId = 42161

  async estimateGas(tx: TransactionRequest) {
    // Arbitrum 透過 ArbOS 報告詳細的 Gas 分解
    const result = await this.publicClient.request({
      method: 'eth_estimateGas',
      params: [tx],
    })

    // Arbitrum 的 gas price 包含 L1 和 L2 部分
    const gasPrice = await this.publicClient.getGasPrice()

    return {
      gasLimit: BigInt(result),
      l1DataGas: 0n, // Arbitrum 內部處理
      l2ExecutionGas: BigInt(result),
      totalCost: BigInt(result) * gasPrice,
    }
  }
}
```

## 最佳實踐：Gas 費用監控與告警

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
          suggestion: 'Gas 價格低於閾值，適合發送交易',
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

## 小結

Gas 管理是 Web3 前端的核心體驗環節。EIP-1559 的雙費用模型讓 Gas 估算更可預測，但前端仍需正確計算 `maxFeePerGas` 和 `maxPriorityFeePerGas`。Gas 估算失敗的處理需要分類——revert、out of gas、nonce 衝突各有不同策略。Multicall 是最有效的 Gas 最佳化手段，能顯著降低批次操作的成本。L2 的 Gas 機制與 L1 差異顯著——Optimism 有 L1 資料成本，Arbitrum 有內部 Gas 折算，前端必須鏈感知地適配。Gas 預測 UI 應在簽名前展示完整費用分解，讓使用者有明確的預期。Gas 監控和告警系統可以幫助使用者在低 Gas 時段發送交易，最佳化交易成本。
