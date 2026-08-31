---
title: "Gas見積もりと最適化：フロントエンドGas管理プラクティス"
date: 2026-07-20 16:24:17
tags:
  - Web3
  - Ethereum
  - 性能优化
readingTime: 9
description: "EIP-1559のGasメカニズム、フロントエンドGas見積もりAPI、バッチ取引最適化戦略、L2 Gas見積もりの違いを深く解説"
wordCount: 1284
---

## Gasメカニズム：EIP-1559のbase fee + priority fee

EIP-1559はイーサリアムのフィー市場を再構築した。各トランザクションのコストは2つの部分で構成される：

- **base fee**：ブロックの混雑度に基づいてプロトコルが動的に調整し、マイナーではなくバーンされる
- **priority fee（tip）**：バリデーターに支払う任意のチップで、トランザクションのパッキング優先度に影響する

トランザクションは2つのパラメータでGas価格を制御する：

- `maxFeePerGas`：ユーザーが支払いを希望する最大Gas価格（base fee + priority feeの上限）
- `maxPriorityFeePerGas`：ユーザーが支払いを希望するpriority fee

実際の支払い：`min(maxFeePerGas, baseFee + maxPriorityFeePerGas)`

base feeが上昇した際、`maxFeePerGas`が十分に高ければトランザクションはパッキングされ、priority feeは自動的に減少する。このメカニズムにより、フロントエンドはGas価格を正確に予測する必要がなく、合理的な上限を設定するだけでよい。

## フロントエンドGas見積もりAPI：eth_estimateGas, eth_feeHistory

イーサリアムはGas見積もりのために2つのコアAPIを提供している：

```typescript
import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// 1. eth_estimateGas — トランザクションに必要なGas Limitを見積もり
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
    // エッジケースを避けるため20%バッファを追加
    return (gas * 120n) / 100n
  } catch (error) {
    // 見積もり失敗は通常トランザクションがrevertすることを意味する
    throw new GasEstimationError(
      'Gas estimation failed. Transaction may revert.',
      error,
    )
  }
}

// 2. eth_feeHistory — 過去のGas価格分布を取得
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

  // 直近ブロックのpriority fee分布を計算
  const rewards = feeHistory.reward || []
  const p10 = rewards.map((r) => r[0]).filter(Boolean)
  const p50 = rewards.map((r) => r[1]).filter(Boolean)
  const p90 = rewards.map((r) => r[2]).filter(Boolean)

  return {
    currentBaseFee: baseFees[baseFees.length - 1],
    nextBaseFee: baseFees[baseFees.length - 1], // 次ブロックの予測base fee
    avgPriorityFee: {
      low: p10.length ? p10.reduce((a, b) => a + b, 0n) / BigInt(p10.length) : 0n,
      medium: p50.length ? p50.reduce((a, b) => a + b, 0n) / BigInt(p50.length) : 0n,
      high: p90.length ? p90.reduce((a, b) => a + b, 0n) / BigInt(p90.length) : 0n,
    },
    congestionLevel: this.calculateCongestion(gasUsedRatio),
  }
}
```

## maxFeePerGasとmaxPriorityFeePerGasの計算

合理的なGas価格計算戦略は確認速度とコストのバランスを取る必要がある：

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

  // 速度設定に基づいてpriority feeを選択
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
    : 1_000_000_000n // デフォルト 1 gwei

  // maxFeePerGas = baseFee * 2 + priorityFee（base fee変動に対する2倍バッファ）
  const maxFeePerGas = baseFee * 2n + avgPriorityFee
  const maxPriorityFeePerGas = avgPriorityFee

  // 確認時間を見積もり
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

## 見積もり失敗の原因と処理

Gas見積もりの失敗はフロントエンドでよくある問題である。主な原因と解決策：

```typescript
class GasEstimationErrorHandler {
  // 見積もり失敗を分類して処理
  async handleEstimationError(
    error: unknown,
    publicClient: PublicClient,
    tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
  ): Promise<GasEstimationResult> {
    // 原因1：トランザクションがrevertする
    const revertReason = await this.tryGetRevertReason(publicClient, tx)
    if (revertReason) {
      return {
        success: false,
        reason: 'revert',
        message: revertReason,
        suggestion: 'コントラクトの条件とパラメータを確認してください',
      }
    }

    // 原因2：Out of Gas（Gas Limit不足）
    const code = await this.estimateGasWithHighLimit(publicClient, tx)
    if (code) {
      return {
        success: false,
        reason: 'out_of_gas',
        message: 'トランザクションのGasが不足しています',
        suggestion: 'Gas Limitを増やしてください',
      }
    }

    // 原因3：Nonce競合
    const nonce = await publicClient.getTransactionCount({
      address: tx.from,
      blockTag: 'pending',
    })
    const pendingTxs = await this.getPendingTransactions(tx.from)
    if (pendingTxs.length > 0) {
      return {
        success: false,
        reason: 'nonce_conflict',
        message: '保留中のトランザクションがブロックしています',
        suggestion: '保留中のトランザクションの完了を待つか加速してください',
      }
    }

    // 原因4：RPCノードの問題
    return {
      success: false,
      reason: 'rpc_error',
      message: 'RPCノードが一時的に利用できません',
      suggestion: 'RPCノードを切り替えて再試行してください',
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

## Gas最適化戦略：バッチトランザクション（multicall）

Multicallは最も効果的なGas最適化手法の一つである。複数のコントラクト呼び出しを1つのトランザクションに統合する：

```typescript
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem'
import { mainnet } from 'viem/chains'

// Multicallアドレス（Ethereum mainnet）
const MULTICALL3_ADDRESS = '0xcA11bde05977b363116702886EbE2E56Ab8d6F2E' as Address

class BatchTransactionBuilder {
  private publicClient: PublicClient

  constructor(rpcUrl: string) {
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }

  // バッチ読み取り（aggregate3）
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

  // バッチ書き込み（複数操作を1トランザクションに統合）
  buildBatchWrite(
    walletClient: WalletClient,
    calls: { target: Address; callData: `0x${string}`; value?: bigint }[],
  ) {
    // メソッド：Multicall3のaggregate3Valueを使用（ETH送信対応）
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

  // 実用例：approve + swap + stakeを1トランザクションで
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

    // Gasを見積もり
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

**Gas節約の定量化**：4件の独立したトランザクションは約 4 × 21,000（ベース）+ 4 × コントラクト実行Gasが必要。Multicallで統合すれば 1 × 21,000 + 4 × コントラクト実行Gasですみ、約63,000 Gasを節約できる。

## コントラクトレベルのGas最適化がフロントエンドに与える影響

コントラクトの最適化はフロントエンドのGas見積もりとUXに直接影響する：

- **ストレージ最適化**：`uint128`を`uint256`の代わりに使うことで複数の変数を1スロットにパッキングできる
- **バッチ操作**：コントラクト提供のバッチ関数はフロントエンドのmulticallより効率的
- **イベント vs ストレージ**：読み取り専用データにストレージではなくイベントを使うことで大幅なGas節約
- **プロキシパターン**：プロキシコントラクトのdelegatecallはcallより約2,000 Gas多く消費

フロントエンドはコントラクトレベルの最適化を認識すべきである。例えば、コントラクトが`batchTransfer`関数を提供している場合、フロントエンドはmulticallで複数回`transfer`を呼ぶのではなく、そちらを優先すべきである。

## 完全なGas見積もり・管理モジュール

```typescript
class GasManager {
  private publicClient: PublicClient
  private priceCache: { price: GasPriceSuggestion; timestamp: number } | null = null
  private cacheTTL = 10000 // 10秒キャッシュ

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient
  }

  // Gas価格を取得（キャッシュ付き）
  async getGasPrice(speed: SpeedPreference = 'standard'): Promise<GasPriceSuggestion> {
    if (this.priceCache && Date.now() - this.priceCache.timestamp < this.cacheTTL) {
      return this.priceCache.price
    }

    const price = await suggestGasPrice(this.publicClient, speed)
    this.priceCache = { price, timestamp: Date.now() }
    return price
  }

  // 完全なトランザクションGas見積もり
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

  // フォールバック付きGas見積もり
  private async estimateGasWithFallback(tx: {
    from: Address
    to: Address
    data?: `0x${string}`
    value?: bigint
  }): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas(tx)
      return (gas * 120n) / 100n // 20%バッファ
    } catch {
      // 固定Gas Limitにフォールバック
      return this.getFallbackGasLimit(tx.data)
    }
  }

  // コールデータサイズからGasを見積もり
  private getFallbackGasLimit(data?: `0x${string}`): bigint {
    if (!data || data === '0x') {
      return 21000n // シンプル送金
    }
    // コントラクト呼び出しベース + データGas
    const dataSize = (data.length - 2) / 2
    return 30000n + BigInt(dataSize * 16)
  }

  private async convertToUsd(wei: bigint): Promise<number> {
    // ChainlinkからETH/USD価格を取得
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

## Gas予測UI：署名前に見積もり費用を表示

優れたGas UIはユーザーが署名する前に完全な費用情報を表示すべきである：

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
          <span>推定総費用</span>
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

## L2 Gas見積もりの違い

L2のGasメカニズムはL1と大幅に異なり、フロントエンドは適応しなければならない：

```typescript
interface L2GasEstimator {
  chainId: number
  estimateGas: (tx: TransactionRequest) => Promise<{
    gasLimit: bigint
    l1DataGas: bigint   // L1データ公開コスト（L2特有）
    l2ExecutionGas: bigint
    totalCost: bigint
  }>
}

// Optimism Gas見積もり
class OptimismGasEstimator implements L2GasEstimator {
  chainId = 10

  async estimateGas(tx: TransactionRequest) {
    const l2Gas = await this.publicClient.estimateGas(tx)

    // OptimismのL1データコスト
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

// Arbitrum Gas見積もり
class ArbitrumGasEstimator implements L2GasEstimator {
  chainId = 42161

  async estimateGas(tx: TransactionRequest) {
    // ArbitrumはArbOSを通じてGasの詳細な内訳を報告
    const result = await this.publicClient.request({
      method: 'eth_estimateGas',
      params: [tx],
    })

    // Arbitrumのgas priceにはL1とL2の部分が含まれる
    const gasPrice = await this.publicClient.getGasPrice()

    return {
      gasLimit: BigInt(result),
      l1DataGas: 0n, // Arbitrumは内部で処理
      l2ExecutionGas: BigInt(result),
      totalCost: BigInt(result) * gasPrice,
    }
  }
}
```

## ベストプラクティス：Gas費用監視とアラート

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
          suggestion: 'Gas価格が閾値を下回りました。トランザクション送信に適しています',
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

## まとめ

Gas管理はWeb3フロントエンドのコア体験要素である。EIP-1559の二重フィーモデルによりGas見積もりはより予測可能になったが、フロントエンドは依然として`maxFeePerGas`と`maxPriorityFeePerGas`を正確に計算する必要がある。見積もり失敗の処理は分類が必要である——revert、out of gas、nonce競合はそれぞれ異なる戦略を要する。Multicallは最も効果的なGas最適化手法であり、バッチ操作のコストを大幅に削減する。L2のGasメカニズムはL1と大幅に異なる——OptimismにはL1データコストがあり、Arbitrumには内部Gas換算があり、フロントエンドはチェーン認識を持って適応しなければならない。Gas予測UIは署名前に費用の内訳を完全に表示し、ユーザーに明確な期待を与えるべきである。Gas監視とアラートシステムはユーザーが低Gas期間にトランザクションを送信するのに役立ち、取引コストを最適化できる。
