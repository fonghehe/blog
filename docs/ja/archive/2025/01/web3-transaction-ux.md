---
title: "Web3 取引状態管理と UX 設計"
date: 2025-01-08 20:59:43
tags:
  - Web3
  - DApp
readingTime: 11
description: "Web3 取引ライフサイクルの各段階を体系的に分析し、完全なフロントエンド状態機械設計と取引追跡ソリューションを提供"
wordCount: 1692
---

## Web3 取引ライフサイクルの完全な段階

Web3 取引のライフサイクルは Web2 の HTTP リクエストよりもはるかに複雑です。一つの取引がユーザー署名から最終確認まで、複数の非同期段階を経る必要があり、各段階で失敗する可能性があります。フロントエンドは各段階に対して明確な状態フィードバックを提供しなければなりません。

典型的な Ethereum 取引は以下の段階を経ます：

```
ユーザー操作
   │
   ▼
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────┐
│  idle     │───▶│  signing │───▶│  pending     │───▶│ confirmed  │
│  (待機中) │    │  (署名中) │    │  (メモリプール中) │    │  (オンチェーン済) │
└──────────┘    └──────────┘    └──────────────┘    └────────────┘
                      │               │                     │
                      ▼               ▼                     ▼
                 ┌──────────┐  ┌──────────┐          ┌──────────┐
                 │ rejected │  │  failed  │          │  final   │
                 │ (ユーザー拒否)│  │ (実行失敗)│          │ (ファイナライズ)  │
                 └──────────┘  └──────────┘          └──────────┘
                                    │
                              ┌─────┴─────┐
                              │           │
                          ┌───▼───┐  ┌───▼───┐
                          │ revert│  │ oog   │
                          │(ロジック失敗)│  │(Gas不足)│
                          └───────┘  └───────┘
```

## pending 状態：取引のメモリプールへの提出

ユーザーが署名すると、取引はメモリプール（mempool）にブロードキャストされます。この時点で取引は pending 状態にあり、マイナー/バリデーターによるパッケージ化を待ちます。

pending 段階の不確実性が最も高いです。取引は以下の可能性があります：

- **迅速にパッケージ化**：Gas 価格が適切な場合、通常 1-2 ブロックでパッケージ化
- **長時間待機**：Gas 価格が低い場合、数時間待つ可能性あり
- **置き換えられる**：ユーザーが RBF（Replace-By-Fee）や取引キャンセルで置き換え可能
- **破棄される**：Gas 価格が低すぎる場合、ノードが mempool から取引を破棄する可能性あり

フロントエンドは pending 段階で「待機中」と表示するだけでなく、推定待機時間と Gas 価格も表示すべきです：

```typescript
// pending 時間を推定
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

  // maxFeePerGas < baseFee の場合、取引はパッケージ化されない
  if (maxFeePerGas < baseFee) {
    return { estimatedBlocks: Infinity, estimatedSeconds: Infinity }
  }

  // 有効な priority fee を計算
  const effectivePriorityFee = maxFeePerGas - baseFee
  const recentPriorityFees = feeHistory.reward.flat()

  // 現在の priority fee より低い取引の割合を見つける
  const lowerCount = recentPriorityFees.filter(
    (fee) => fee < effectivePriorityFee,
  ).length
  const percentile = lowerCount / recentPriorityFees.length

  // パーセンタイルが高いほど確認が速い
  const estimatedBlocks = Math.max(1, Math.ceil(3 / percentile))
  const estimatedSeconds = estimatedBlocks * 12 // Ethereum ブロック時間

  return { estimatedBlocks, estimatedSeconds }
}
```

## confirmation：ブロック確認数とファイナリティ

取引がブロックにパッケージ化された後、即座に「最終確認」とは見なされません。異なるシナリオで異なる確認数が必要です：

- **少額取引**：1-3 ブロック確認で十分
- **大額取引**：12+ ブロック確認
- **クロスチェーンブリッジ**：ファイナライズが必要（約 64 ブロック、~12.8 分）
- **L2 取引**：通常 1 ブロックで十分（ソフト確認）、ただしウィズドロワルには L1 ファイナライズが必要

```typescript
interface ConfirmationConfig {
  required: number        // 必要な確認数
  final: number           // ファイナライズ確認数
  label: (current: number) => string
}

function getConfirmationConfig(
  chainId: number,
  txValue: bigint,
): ConfirmationConfig {
  // 取引金額とチェーンタイプに基づいて確認数を決定
  if (txValue > parseEther('10')) {
    return {
      required: 12,
      final: 64,
      label: (c) => c >= 12 ? '安全確認' : `確認中 ${c}/12`,
    }
  }

  const chainConfigs: Record<number, ConfirmationConfig> = {
    1: { required: 3, final: 64, label: (c) => c >= 3 ? '確認済み' : `確認中 ${c}/3` },
    10: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? '高速確認' : '確認中' },
    42161: { required: 1, final: 604800 / 12, label: (c) => c >= 1 ? '高速確認' : '確認中' },
  }

  return chainConfigs[chainId] ?? chainConfigs[1]
}
```

## failed：revert、out of gas、nonce 衝突

取引失敗には三つの主な原因があり、フロントエンドは正確に区別する必要があります：

**1. Revert（ロジック失敗）**

コントラクトが `require(false)` や類似の条件を実行した場合にトリガーされます。取引はオンチェーンになりますが状態はロールバックされます。フロントエンドは revert reason をデコードする必要があります：

```typescript
async function decodeRevertReason(
  publicClient: PublicClient,
  txHash: Hash,
): Promise<string> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

  if (receipt.status === 'success') {
    return 'Transaction succeeded'
  }

  // 方法一：trace を通じて revert reason を取得
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
    // 方法二：取引を再シミュレーション
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

取引の Gas Limit が実行完了に不十分な場合。フロントエンドは取引送信前に正確に Gas を推定すべきです：

```typescript
async function estimateGasWithBuffer(
  publicClient: PublicClient,
  tx: { from: Address; to: Address; data: `0x${string}`; value?: bigint },
): Promise<bigint> {
  const estimated = await publicClient.estimateGas(tx)
  // 20% のバッファを追加
  return (estimated * 120n) / 100n
}
```

**3. Nonce 衝突**

複数の取引を送信する際、nonce が連続していないと後続の取引が pending 状態で詰まります：

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

## フロントエンド状態機械設計

完全な取引状態機械は有限状態オートマトン（FSM）であるべきで、各状態には明確な遷移条件があります：

```typescript
// 取引状態機械
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

## 取引追跡：receipt ポーリング vs WebSocket イベント

二つの取引追跡方法にはそれぞれトレードオフがあります：

**Receipt ポーリング**：シンプルで信頼性が高く、すべての RPC エンドポイントに対応。ただし遅延が大きい。

**WebSocket イベント**：リアルタイム性が良いが、接続が不安定な場合にイベントを失いやすい。

推奨戦略は両者の組み合わせです：WebSocket を主とし、ポーリングを補助とします：

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

    // 先にポーリングで receipt を取得
    this.startPolling(hash)

    // WebSocket があれば購読も行う
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
          // 確認追跡を開始
          this.startConfirmationTracking(hash, receipt)
          this.pollingTimers.delete(hash)
          return
        }
      } catch (error) {
        // サイレントリトライ
      }

      // ポーリング継続
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

      // ファイナライズをチェック
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
          // WebSocket がイベントを受信したら、ポーリングで完全な receipt を取得
          this.startPolling(hash)
        }
      }
    })
  }

  private async subscribeToReceipt(hash: Hash) {
    // pending 取引を購読
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

## 完全な取引状態マネージャー

状態機械、トラッカー、UX フィードバックを統合します：

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

        // 通知を送信
        this.handleNotifications(newState)

        // ビジネスコールバックを実行
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
        this.notifications.info('取引が提出されました。パッケージ化待ち...')
        break
      case 'confirmed':
        this.notifications.success('取引が確認されました')
        break
      case 'failed':
        this.notifications.error(`取引失敗: ${state.reason}`)
        break
      case 'rejected':
        this.notifications.warning(`取引が拒否されました: ${state.reason}`)
        break
    }
  }

  private handleCallbacks(
    state: TransactionState,
    options?: { requiredConfirmations?: number },
  ) {
    const required = options?.requiredConfirmations ?? 3
    if (state.status === 'confirming' && state.confirmations >= required) {
      // 成功コールバックを実行
    }
    if (state.status === 'failed') {
      // 失敗コールバックを実行
    }
  }
}
```

## UX 設計：進捗表示、失敗リトライ、取引キャンセル

**進捗表示**：

```tsx
function TransactionStatus({ state }: { state: TransactionState }) {
  switch (state.status) {
    case 'signing':
      return <Spinner label="ウォレットで確認してください..." />

    case 'pending':
      return (
        <div>
          <Spinner label="取引パッケージ化中..." />
          <span>推定 {state.estimatedSeconds} 秒</span>
          <a href={getEtherscanUrl(state.hash)}>エクスプローラーで表示</a>
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
          <Alert type="error">取引失敗: {state.reason}</Alert>
          <Button onClick={retry}>リトライ</Button>
        </div>
      )
  }
}
```

**失敗リトライ**：

```typescript
async function retryTransaction(
  manager: TransactionManager,
  failedState: { status: 'failed'; hash: Hash; receipt: TransactionReceipt },
  walletClient: WalletClient,
) {
  // 元の取引データを取得
  const originalTx = await publicClient.getTransaction({ hash: failedState.receipt.transactionHash })

  // Gas 制限を増加
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

**取引キャンセル**：

```typescript
async function cancelTransaction(
  walletClient: WalletClient,
  pendingHash: Hash,
  publicClient: PublicClient,
) {
  // 保留中の取引の nonce を取得
  const tx = await publicClient.getTransaction({ hash: pendingHash })

  // 同じ nonce、to=自分、value=0 の取引を送信
  const cancelHash = await walletClient.sendTransaction({
    to: walletClient.account!.address,
    value: 0n,
    gas: 21000n,
    nonce: tx.nonce,
    // より高い Gas 価格を設定して優先パッケージ化を確保
    maxFeePerGas: (tx.gasPrice! * 110n) / 100n,
  })

  return cancelHash
}
```

## マルチチェーン取引の確認基準の違い

異なるチェーンの確認基準の違いは甚大です。フロントエンドはチェーン設定テーブルを維持し、自動的に適応すべきです：

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

## ベストプラクティス：取引通知システム設計

良好な取引通知システムは以下を満たすべきです：

- **マルチチャネル通知**：Toast 通知 + 取引履歴記録 + オプションのプッシュ通知
- **状態同期**：ページリフレッシュ後も取引状態を復元可能
- **バッチ管理**：複数取引を同時追跡し、集約表示
- **キャンセル可能**：pending 状態の取引にキャンセル操作を提供
- **リトライ可能**：failed 状態の取引にワンクリックリトライを提供

```typescript
// 取引状態を localStorage に永続化
function persistTransaction(hash: Hash, state: TransactionState) {
  const key = `tx:${hash}`
  const data = { state, timestamp: Date.now() }
  localStorage.setItem(key, JSON.stringify(data))
}

// ページ読み込み時に未完了の取引を復元
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

## まとめ

Web3 取引状態管理は DApp フロントエンドにおいて最も中核的で複雑な部分です。取引の非同期性、多段階性、失敗可能性により、フロントエンドは厳格な状態機械モデルを採用しなければなりません。署名からファイナライズまで、各段階で明確な UI フィードバックが必要です。receipt ポーリングと WebSocket イベントのハイブリッド追跡戦略は信頼性とリアルタイム性を両立します。マルチチェーン環境では、確認基準の違いによりフロントエンドにチェーン感知能力が必要です。取引状態を永続化しページリフレッシュ後に復元することは、プロフェッショナルな DApp の基本要件です。取引通知システムの設計はユーザーの信頼を中核とすべきです——ユーザーが自身の取引がどの段階にあるか、安全か、何が問題かを常に把握できるようにすることです。
