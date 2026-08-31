---
title: "Web3 DAppパフォーマンス最適化：RPCリクエストとオンチェーンデータキャッシュ"
date: 2026-08-07 19:44:35
tags:
  - Web3
  - 性能优化
  - DApp
readingTime: 12
description: "DAppのパフォーマンスボトルネックを体系的に分析。RPCバッチリクエスト、マルチノードポーリング、SWRキャッシュ戦略、インデックスサービス比較、バンドル最適化をカバー"
wordCount: 2031
---

## DAppパフォーマンスボトルネック分析：RPCレイテンシが最大の問題

DAppのパフォーマンスボトルネックは従来のWebアプリケーションとは根本的に異なる。従来のアプリのボトルネックは通常データベースクエリやAPIレスポンスだが、DAppの主要なボトルネックはRPCリクエストのレイテンシである。オンチェーンデータの読み取り——残高、コントラクト状態、イベントログ——にはそれぞれ完全なRPCラウンドトリップが必要で、レイテンシは通常100-500ms、従来のAPI呼び出しの5-10倍遅い。

DAppの初回画面読み込み時の典型的なRPCリクエスト量：

```
ページ読み込み時：
├── 現在のブロック番号を取得       (1 RPC)
├── ユーザーのETH残高を取得         (1 RPC)
├── ユーザーのトークン残高 × Nを取得 (N RPC)
├── コントラクト状態を取得           (3-5 RPC)
├── 履歴イベントログを取得           (1-2 RPC)
├── Gas価格を取得                    (1 RPC)
└── チェーンIDとネットワーク情報を取得 (1 RPC)
─────────────────────────────────────
合計：8-12 RPCリクエスト
シリアルレイテンシ：800ms - 6000ms
```

これらのリクエストがシリアルに実行されると、初回画面読み込み時間は3秒を超える。最適化の核心的な目標は、シリアルをパラレルに変換し、リクエスト総数を減らすことである。

## RPCバッチリクエスト：Multicallコントラクトとmulticall.js

Multicall3コントラクトは最も効果的なRPCリクエスト最適化手段である。1回のトランザクションで複数のコントラクトの複数の関数を呼び出し、N回のRPCリクエストを1回に統合する：

```typescript
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const MULTICALL3_ADDRESS = '0xcA11bde05977b363116702886EbE2E56Ab8d6F2E' as Address

class MulticallReader {
  private publicClient: PublicClient

  constructor(rpcUrl: string) {
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }

  // コントラクトデータをバッチ読み取り
  async batchRead<T extends readonly { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }[]>(
    calls: T,
  ): Promise<{ result: unknown; status: 'success' | 'failure'; error?: string }[]> {
    // viemの組み込みmulticallを使用
    const results = await this.publicClient.multicall({
      contracts: calls,
      allowFailure: true,
    })

    return results.map((r) => ({
      result: r.status === 'success' ? r.result : null,
      status: r.status,
      error: r.status === 'failure' ? r.error?.message : undefined,
    }))
  }

  // 実用例：1回のリクエストでユーザーの全トークン残高を取得
  async getAllTokenBalances(
    userAddress: Address,
    tokens: { address: Address; symbol: string; decimals: number }[],
  ) {
    const calls = tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    }))

    // ETH残高のクエリも追加可能
    const ethBalanceCall = {
      address: MULTICALL3_ADDRESS,
      abi: multicall3Abi,
      functionName: 'getEthBalance',
      args: [userAddress],
    }

    const results = await this.batchRead([...calls, ethBalanceCall])

    return {
      eth: results[results.length - 1].result as bigint,
      tokens: tokens.map((token, i) => ({
        symbol: token.symbol,
        balance: results[i].result as bigint,
        decimals: token.decimals,
      })),
    }
  }

  // viemの組み込みmulticallを使用（よりシンプルなAPI）
  async batchReadWithViem(userAddress: Address, tokens: Address[]) {
    const balances = await this.publicClient.multicall({
      contracts: tokens.map((address) => ({
        address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      })),
    })

    return balances.map((b) => b.status === 'success' ? b.result : 0n)
  }
}
```

**パフォーマンス比較**：10個のトークン残高を取得する場合、シリアルでは10回のRPC（~2-5s）が必要だが、Multicallでは1回（~200-400ms）で済み、約10倍の向上。

## マルチノードポーリングとフェイルオーバー

単一のRPCノードは単一障害点である。マルチノードポーリングは可用性と速度を向上させる：

```typescript
type RpcNodeStatus = {
  url: string
  healthy: boolean
  latency: number
  failureCount: number
  lastCheck: number
}

class RpcPool {
  private nodes: RpcNodeStatus[]
  private currentIndex = 0
  private maxFailures = 3
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(urls: string[]) {
    this.nodes = urls.map((url) => ({
      url,
      healthy: true,
      latency: 0,
      failureCount: 0,
      lastCheck: 0,
    }))
  }

  // ベストノードを取得（レイテンシが最も低いヘルシーなノード）
  getBestNode(): string {
    const healthy = this.nodes.filter((n) => n.healthy)
    if (healthy.length === 0) {
      // 全ノードが不健康な場合、リセットして最初を返す
      this.nodes.forEach((n) => (n.healthy = true))
      return this.nodes[0].url
    }
    // レイテンシでソート、最速を選択
    healthy.sort((a, b) => a.latency - b.latency)
    return healthy[0].url
  }

  // ラウンドロビンで次のノードを取得
  getNextNode(): string {
    const healthy = this.nodes.filter((n) => n.healthy)
    if (healthy.length === 0) {
      this.nodes.forEach((n) => (n.healthy = true))
      return this.nodes[0].url
    }
    const node = healthy[this.currentIndex % healthy.length]
    this.currentIndex++
    return node.url
  }

  // フェイルオーバー付きリクエスト
  async request<T>(method: string, params: unknown[]): Promise<T> {
    const maxRetries = this.nodes.filter((n) => n.healthy).length
    let lastError: Error | null = null

    for (let i = 0; i < maxRetries; i++) {
      const nodeUrl = this.getNextNode()
      try {
        const result = await this.executeRpc<T>(nodeUrl, method, params)
        this.recordSuccess(nodeUrl)
        return result
      } catch (error) {
        this.recordFailure(nodeUrl)
        lastError = error as Error
      }
    }

    throw lastError || new Error('All RPC nodes failed')
  }

  private async executeRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
    const startTime = Date.now()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(10000), // 10秒タイムアウト
    })

    const latency = Date.now() - startTime
    const node = this.nodes.find((n) => n.url === url)
    if (node) node.latency = latency

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    if (json.error) throw new Error(json.error.message)
    return json.result
  }

  private recordSuccess(url: string) {
    const node = this.nodes.find((n) => n.url === url)
    if (node) {
      node.failureCount = 0
      node.healthy = true
    }
  }

  private recordFailure(url: string) {
    const node = this.nodes.find((n) => n.url === url)
    if (node) {
      node.failureCount++
      if (node.failureCount >= this.maxFailures) {
        node.healthy = false
      }
    }
  }

  // ヘルスチェックを開始
  startHealthCheck(intervalMs: number = 30000) {
    this.healthCheckInterval = setInterval(async () => {
      await Promise.all(
        this.nodes.map(async (node) => {
          try {
            const start = Date.now()
            await this.executeRpc(node.url, 'eth_blockNumber', [])
            node.latency = Date.now() - start
            node.healthy = true
            node.failureCount = 0
          } catch {
            node.healthy = false
            node.failureCount++
          }
          node.lastCheck = Date.now()
        }),
      )
    }, intervalMs)
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
  }
}

// 使用：マルチノード接続プールを作成
const rpcPool = new RpcPool([
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
])
rpcPool.startHealthCheck()
```

## SWR / React Queryキャッシュ戦略

キャッシュはRPCリクエストを減らす鍵である。SWRとReact QueryはReactエコシステムで最も人気のある2つのデータキャッシュライブラリである：

```typescript
import useSWR from 'swr'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// SWRアプローチ
function useTokenBalance(address: Address, token: Address) {
  return useSWR(
    ['balance', address, token],
    async () => {
      const publicClient = getPublicClient()
      return publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
    },
    {
      revalidateOnFocus: false,     // タブフォーカス時に自動更新しない
      dedupingInterval: 10000,      // 10秒以内に重複排除
      refreshInterval: 30000,       // 30秒ごとに自動更新
      errorRetryCount: 3,
    },
  )
}

// React Queryアプローチ
function useTokenBalanceQuery(address: Address, token: Address) {
  return useQuery({
    queryKey: ['balance', address, token],
    queryFn: async () => {
      const publicClient = getPublicClient()
      return publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
    },
    staleTime: 10000,      // 10秒以内は再リクエストしない
    gcTime: 300000,        // 5分後にキャッシュをクリーンアップ
    retry: 3,
    refetchOnWindowFocus: false,
  })
}

// トランザクション後に残高を自動更新
function useSwapAndRefresh() {
  const queryClient = useQueryClient()

  const swap = async (tokenIn: Address, tokenOut: Address, amount: bigint) => {
    // swapトランザクションを実行
    const hash = await executeSwap(tokenIn, tokenOut, amount)

    // 確認を待機
    await waitForConfirmation(hash)

    // 関連するクエリキャッシュを無効化
    await queryClient.invalidateQueries({
      queryKey: ['balance'],
    })
  }

  return { swap }
}
```

**キャッシュ戦略のポイント**：

- 残高データ：10-30秒ごとに更新（ユーザーが他の場所から転送を受け取る可能性）
- コントラクト読み取り専用状態：5-10分ごとに更新（変更頻度が低い）
- イベントログ：キャッシュしないか1分ごとに更新
- トランザクション履歴：ユーザー操作後に手動更新

## インデックスサービス：The Graph vs 自前インデックス

RPCから直接履歴イベントをクエリするのは非常に非効率である——ブロックを順に処理し、ブロックごとに1回のRPC呼び出しが必要になる。インデックスサービスは事前にインデックスを構築することでこの問題を解決する。

```typescript
// The Graphクエリ
import { gql, request } from 'graphql-request'

const TRANSFERS_QUERY = gql`
  query GetTransfers($user: Bytes!, $first: Int!) {
    transfers(
      where: { from: $user }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      from
      to
      value
      timestamp
      transactionHash
    }
  }
`

async function getUserTransfers(user: Address, limit: number = 50) {
  const data = await request(
    'https://api.thegraph.com/subgraphs/name/protocol/subgraph',
    TRANSFERS_QUERY,
    { user: user.toLowerCase(), first: limit },
  )
  return data.transfers
}

// 自前インデックス（viem watchEvent + ローカルデータベースを使用）
class LocalIndexer {
  private db: Map<string, any[]> = new Map()

  constructor(
    private publicClient: PublicClient,
    private contractAddress: Address,
    private abi: Abi,
  ) {}

  start() {
    this.publicClient.watchEvent({
      address: this.contractAddress,
      event: getEventFromAbi(this.abi, 'Transfer'),
      onLogs: (logs) => {
        for (const log of logs) {
          this.indexTransfer(log)
        }
      },
    })
  }

  private indexTransfer(log: any) {
    const { from, to, value } = log.args
    const key = `transfers:${from.toLowerCase()}`
    const transfers = this.db.get(key) || []
    transfers.unshift({
      from,
      to,
      value,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    })
    this.db.set(key, transfers)
  }

  getTransfers(user: Address, limit: number = 50) {
    const key = `transfers:${user.toLowerCase()}`
    return (this.db.get(key) || []).slice(0, limit)
  }
}
```

**The Graph vs 自前インデックス**：

| 次元 | The Graph | 自前インデックス |
|------|-----------|----------------|
| 開発コスト | 低い（GraphQL Schemaを書く） | 高い（バックエンドインフラが必要） |
| クエリの柔軟性 | 高い（GraphQL） | カスタム |
| レイテンシ | 低い（インデックス完了） | 同期状態に依存 |
| コスト | クエリごとの従量課金（GRT） | サーバーコスト |
| 非中央集権 | はい | いいえ |
| 適したシーン | 汎用DApp | 特定の高性能クエリ |

## プリロード戦略：ルートレベルのデータプリフェッチ

ユーザーがページにナビゲートする前にデータをプリフェッチすることで、ロード待ちをなくせる：

```typescript
import { prefetchQuery } from '@tanstack/react-query-prefetch'

// ルートレベルのプリフェッチ
async function prefetchPoolData(poolAddress: Address) {
  const queryClient = getQueryClient()

  // 必要な全データを並列プリフェッチ
  await Promise.all([
    prefetchQuery({
      queryKey: ['pool', poolAddress, 'info'],
      queryFn: () => getPoolInfo(poolAddress),
      queryClient,
      staleTime: 60000,
    }),
    prefetchQuery({
      queryKey: ['pool', poolAddress, 'reserves'],
      queryFn: () => getPoolReserves(poolAddress),
      queryClient,
      staleTime: 30000,
    }),
    prefetchQuery({
      queryKey: ['pool', poolAddress, 'volume24h'],
      queryFn: () => getPoolVolume(poolAddress),
      queryClient,
      staleTime: 60000,
    }),
  ])
}

// リンクホバー時にプリフェッチ
function PoolLink({ address, children }: { address: Address; children: React.ReactNode }) {
  return (
    <Link
      to={`/pool/${address}`}
      onMouseEnter={() => prefetchPoolData(address)}
    >
      {children}
    </Link>
  )
}
```

## 高性能DAppデータレイヤー

全最適化戦略を統合：

```typescript
class DAppDataLayer {
  private multicallReader: MulticallReader
  private rpcPool: RpcPool
  private queryClient: QueryClient
  private indexer: LocalIndexer | null = null

  constructor(config: {
    rpcUrls: string[]
    indexerConfig?: { address: Address; abi: Abi }
  }) {
    this.rpcPool = new RpcPool(config.rpcUrls)
    this.rpcPool.startHealthCheck()

    const bestUrl = this.rpcPool.getBestNode()
    this.multicallReader = new MulticallReader(bestUrl)

    this.queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10000,
          gcTime: 300000,
          retry: 3,
          refetchOnWindowFocus: false,
        },
      },
    })

    if (config.indexerConfig) {
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(this.rpcPool.getBestNode()),
      })
      this.indexer = new LocalIndexer(
        publicClient,
        config.indexerConfig.address,
        config.indexerConfig.abi,
      )
      this.indexer.start()
    }
  }

  // ダッシュボードデータをバッチ取得
  async fetchDashboardData(userAddress: Address) {
    return this.queryClient.fetchQuery({
      queryKey: ['dashboard', userAddress],
      queryFn: async () => {
        // Multicallで全データを一括取得
        const [balances, allowances, positions] = await Promise.all([
          this.multicallReader.getAllTokenBalances(userAddress, KNOWN_TOKENS),
          this.multicallReader.batchRead(
            KNOWN_TOKENS.map((token) => ({
              address: token.address,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [userAddress, SPENDER_ADDRESS],
            })),
          ),
          this.fetchUserPositions(userAddress),
        ])

        return { balances, allowances, positions }
      },
      staleTime: 15000, // 15秒キャッシュ
    })
  }

  // ノード障害時に自動切り替え
  private async withFailover<T>(fn: (url: string) => Promise<T>): Promise<T> {
    const maxRetries = 3
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(this.rpcPool.getBestNode())
      } catch (error) {
        if (i === maxRetries - 1) throw error
        // 短時間待ってからリトライ
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
    throw new Error('Unreachable')
  }
}
```

## パフォーマンス指標：DAppにおけるFCP, LCP, TTIの特別な考慮事項

DAppのパフォーマンス指標には特別な考慮事項がある：

- **FCP (First Contentful Paint)**：DAppはFCP時にスケルトンスクリーンを表示すべきで、RPCレスポンスを待つべきではない
- **LCP (Largest Contentful Paint)**：重要なオンチェーンデータ（トークン残高など）は2秒以内に読み込まれるべき
- **TTI (Time to Interactive)**：DAppのTTIはウォレット接続状態の影響を受けるが、未接続でもインタラクティブであるべき

```typescript
// パフォーマンスモニタリング
class DAppPerformanceMonitor {
  private metrics: Record<string, number> = {}

  startMeasure(key: string) {
    this.metrics[`${key}_start`] = performance.now()
  }

  endMeasure(key: string) {
    const start = this.metrics[`${key}_start`]
    if (start) {
      const duration = performance.now() - start
      this.metrics[key] = duration
      console.log(`[Performance] ${key}: ${duration.toFixed(2)}ms`)

      // 分析サービスに報告
      if (duration > 2000) {
        this.reportSlowQuery(key, duration)
      }
    }
  }

  private reportSlowQuery(key: string, duration: number) {
    // スロークエリを報告
    analytics.track('slow_query', { key, duration })
  }
}

// 使用：クリティカルパスを測定
const perf = new DAppPerformanceMonitor()

async function loadDashboard(userAddress: Address) {
  perf.startMeasure('dashboard_load')
  const data = await dataLayer.fetchDashboardData(userAddress)
  perf.endMeasure('dashboard_load')
  return data
}
```

## フロントエンドバンドル最適化：wagmi/viemのtree shaking

viemとwagmi v2はtree-shakableとして設計されているが、優位性を発揮するには適切な設定が必要：

```typescript
// ❌ 間違い：ライブラリ全体をインポート
import { viem } from 'viem' // 存在しないが、同様の間違い

// ✅ 正しい：オンデマンドでインポート
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { useReadContract, useWriteContract } from 'wagmi'

// vite.config.tsの最適化設定
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'viem-core': ['viem'],
          'viem-chains': ['viem/chains'],
          'wagmi': ['wagmi'],
        },
      },
    },
  },
})

// 使用するチェーン設定のみインポート（全てではなく）
// ❌ import * as chains from 'viem/chains'  // 100以上のチェーンを全てインポート
// ✅ import { mainnet, optimism } from 'viem/chains'  // 2つのみインポート
```

**バンドルサイズ比較**（minified + gzipped）：

| 設定 | バンドルサイズ |
|------|---------------|
| viem + wagmiフルインポート | 145 KB |
| オンデマンドインポート + tree shaking | 42 KB |
| オンデマンド + manualChunks | 38 KB |

## まとめ：DAppパフォーマンス最適化の完全チェックリスト

1. **RPCリクエスト最適化**
   - Multicall3でバッチ読み取り、N回のリクエストを1回に統合
   - マルチノードポーリングとフェイルオーバーで単一障害点を回避
   - リクエストの重複排除と並行制御

2. **キャッシュ戦略**
   - 残高データ：10-30秒ごとに更新
   - コントラクト読み取り専用状態：5-10分ごとに更新
   - トランザクション後に関連キャッシュを能動的に無効化

3. **インデックスサービス**
   - 履歴データクエリにThe Graphまたは自前インデックスを使用
   - リアルタイムデータにRPC + watchEventを使用
   - 複雑な集計クエリにインデックスサービスを使用

4. **プリロード**
   - ルートレベルのデータプリフェッチ
   - キーページのホバープリフェッチ
   - 初回画面クリティカルパスデータの並列リクエスト

5. **バンドル最適化**
   - viem/wagmiのオンデマンドインポート
   - 使用するチェーン設定のみインポート
   - manualChunksでコード分割

6. **パフォーマンスモニタリング**
   - RPCリクエストレイテンシの監視
   - FCP/LCP/TTIの追跡
   - スロークエリアラート

## まとめ

DAppパフォーマンス最適化の核心はRPCリクエスト数とレイテンシの削減にある。Multicall3は最も効果的な手段で、N回のリクエストを1回に統合する。ヘルスチェック付きマルチノードプールが高可用性を確保する。SWR/React Queryのキャッシュ戦略が重複リクエストを防ぎ、トランザクション後の能動的無効化がデータの鮮度を保証する。インデックスサービスは履歴データクエリのパフォーマンス問題を解決する——RPCから直接イベントログを順に処理するのは現実的ではない。プリロード戦略によりユーザーはロード待ちを感じない。バンドル最適化はtree-shakingとコード分割で実現する。パフォーマンスモニタリングは継続的なプロセスであるべき——DAppのパフォーマンスボトルネックはオンチェーン活動とユーザーの増加に伴い変化する。完全なパフォーマンス最適化チェックリストを構築し、継続的にイテレートすることが、高性能DAppを構築するための道である。
