---
title: "Web3 DApp 性能優化：RPC 請求與鏈上數據緩存"
date: 2026-08-07 19:44:35
tags:
  - Web3
  - 性能優化
  - DApp
readingTime: 9
description: "系統性分析 DApp 性能瓶頸，涵蓋 RPC 批量請求、多節點輪詢、SWR 緩存策略、索引服務對比及 bundle 優化"
wordCount: 1208
---

## DApp 性能瓶頸分析：RPC 延遲是最大問題

DApp 的性能瓶頸與傳統 Web 應用截然不同。傳統應用的瓶頸通常在數據庫查詢或 API 響應，而 DApp 的首要瓶頸是 RPC 請求延遲。每次讀取鏈上數據——餘額、合約狀態、事件日誌——都需要一次完整的 RPC 往返，延遲通常在 100-500ms 之間，是傳統 API 調用的 5-10 倍。

典型 DApp 首屏加載的 RPC 請求量：

```
頁面加載時：
├── 獲取當前區塊號           (1 次 RPC)
├── 獲取用戶 ETH 餘額         (1 次 RPC)
├── 獲取用戶代幣餘額 × N      (N 次 RPC)
├── 獲取合約狀態              (3-5 次 RPC)
├── 獲取歷史事件日誌          (1-2 次 RPC)
├── 獲取 Gas 價格             (1 次 RPC)
└── 獲取鏈 ID 和網絡信息       (1 次 RPC)
─────────────────────────────
總計：8-12 次 RPC 請求
串行延遲：800ms - 6000ms
```

如果這些請求串行執行，首屏加載時間將超過 3 秒。優化的核心目標是將串行轉為並行，並減少請求總數。

## RPC 批量請求：Multicall 合約與 multicall.js

Multicall3 合約是最有效的 RPC 請求優化手段。它允許在一次交易中調用多個合約的多個函數，將 N 次 RPC 請求合併為 1 次：

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

  // 批量讀取合約數據
  async batchRead<T extends readonly { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }[]>(
    calls: T,
  ): Promise<{ result: unknown; status: 'success' | 'failure'; error?: string }[]> {
    // 使用 viem 內置的 multicall
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

  // 實際使用：一次請求獲取用戶的所有代幣餘額
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

    // 還可以加入 ETH 餘額查詢
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

  // 使用 viem 內置 multicall（更簡潔的 API）
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

**性能對比**：獲取 10 個代幣餘額，串行需要 10 次 RPC（~2-5s），Multicall 只需 1 次（~200-400ms），提升約 10 倍。

## 多節點輪詢與故障轉移

單一 RPC 節點是單點故障。多節點輪詢可以提高可用性和速度：

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

  // 獲取最佳節點（延遲最低的健康節點）
  getBestNode(): string {
    const healthy = this.nodes.filter((n) => n.healthy)
    if (healthy.length === 0) {
      // 所有節點都不健康，重置並返回第一個
      this.nodes.forEach((n) => (n.healthy = true))
      return this.nodes[0].url
    }
    // 按延遲排序，選擇最快的
    healthy.sort((a, b) => a.latency - b.latency)
    return healthy[0].url
  }

  // 輪詢獲取下一個節點
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

  // 帶故障轉移的請求
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
      signal: AbortSignal.timeout(10000), // 10 秒超時
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

  // 啟動健康檢查
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

// 使用：創建多節點連接池
const rpcPool = new RpcPool([
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
])
rpcPool.startHealthCheck()
```

## SWR / React Query 緩存策略

緩存是減少 RPC 請求的關鍵。SWR 和 React Query 是 React 生態中最流行的兩個數據緩存庫：

```typescript
import useSWR from 'swr'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// SWR 方案
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
      revalidateOnFocus: false,     // 切回標籤頁時不自動刷新
      dedupingInterval: 10000,      // 10 秒內去重
      refreshInterval: 30000,       // 30 秒自動刷新
      errorRetryCount: 3,
    },
  )
}

// React Query 方案
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
    staleTime: 10000,      // 10 秒內不重新請求
    gcTime: 300000,        // 5 分鐘後清理緩存
    retry: 3,
    refetchOnWindowFocus: false,
  })
}

// 交易後自動刷新餘額
function useSwapAndRefresh() {
  const queryClient = useQueryClient()

  const swap = async (tokenIn: Address, tokenOut: Address, amount: bigint) => {
    // 執行 swap 交易
    const hash = await executeSwap(tokenIn, tokenOut, amount)

    // 等待確認
    await waitForConfirmation(hash)

    // 失效相關查詢緩存
    await queryClient.invalidateQueries({
      queryKey: ['balance'],
    })
  }

  return { swap }
}
```

**緩存策略要點**：

- 餘額數據：10-30 秒刷新一次（用戶可能從其他地方收到轉賬）
- 合約只讀狀態：5-10 分鐘刷新（變化頻率低）
- 事件日誌：不緩存或 1 分鐘刷新
- 交易歷史：用戶操作後手動刷新

## 索引服務：The Graph vs 自建索引

直接從 RPC 查詢歷史事件效率極低——需要遍歷區塊，每個區塊一次 RPC 調用。索引服務通過預先建立索引解決這個問題。

```typescript
// The Graph 查詢
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

// 自建索引（使用 viem watchEvent + 本地數據庫）
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

**The Graph vs 自建索引**：

| 維度 | The Graph | 自建索引 |
|------|-----------|---------|
| 開發成本 | 低（寫 GraphQL Schema） | 高（需要後端基礎設施） |
| 查詢靈活性 | 高（GraphQL） | 自定義 |
| 延遲 | 低（索引已完成） | 取決於同步狀態 |
| 成本 | 按查詢付費（GRT） | 服務器成本 |
| 去中心化 | 是 | 否 |
| 適合場景 | 通用 DApp | 特定高性能查詢 |

## 預加載策略：路由級數據預取

在用戶導航到頁面之前預取數據，可以消除加載等待：

```typescript
import { prefetchQuery } from '@tanstack/react-query-prefetch'

// 路由級預取
async function prefetchPoolData(poolAddress: Address) {
  const queryClient = getQueryClient()

  // 並行預取所有需要的數據
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

// 在導航鏈接上懸停時預取
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

## 高性能 DApp 數據層

整合上述所有優化策略：

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

  // 批量獲取首頁數據
  async fetchDashboardData(userAddress: Address) {
    return this.queryClient.fetchQuery({
      queryKey: ['dashboard', userAddress],
      queryFn: async () => {
        // 使用 Multicall 一次獲取所有數據
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
      staleTime: 15000, // 15 秒緩存
    })
  }

  // 節點故障時自動切換
  private async withFailover<T>(fn: (url: string) => Promise<T>): Promise<T> {
    const maxRetries = 3
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(this.rpcPool.getBestNode())
      } catch (error) {
        if (i === maxRetries - 1) throw error
        // 等待短暫時間後重試
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
    throw new Error('Unreachable')
  }
}
```

## 性能指標：FCP, LCP, TTI 在 DApp 中的特殊考量

DApp 的性能指標與傳統 Web 應用有特殊考量：

- **FCP (First Contentful Paint)**：DApp 應在 FCP 時展示骨架屏，不等待 RPC 響應
- **LCP (Largest Contentful Paint)**：關鍵鏈上數據（如代幣餘額）應在 2 秒內加載完成
- **TTI (Time to Interactive)**：DApp 的 TTI 受錢包連接狀態影響，未連接時也應可交互

```typescript
// 性能監控
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

      // 上報到分析服務
      if (duration > 2000) {
        this.reportSlowQuery(key, duration)
      }
    }
  }

  private reportSlowQuery(key: string, duration: number) {
    // 上報慢查詢
    analytics.track('slow_query', { key, duration })
  }
}

// 使用：在關鍵路徑上測量
const perf = new DAppPerformanceMonitor()

async function loadDashboard(userAddress: Address) {
  perf.startMeasure('dashboard_load')
  const data = await dataLayer.fetchDashboardData(userAddress)
  perf.endMeasure('dashboard_load')
  return data
}
```

## 前端 bundle 優化：wagmi/viem 的 tree shaking

viem 和 wagmi v2 設計為 tree-shakable，但需要正確配置才能發揮優勢：

```typescript
// ❌ 錯誤：導入整個庫
import { viem } from 'viem' // 不存在，但類似的錯誤寫法

// ✅ 正確：按需導入
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { useReadContract, useWriteContract } from 'wagmi'

// vite.config.ts 中的優化配置
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

// 只導入使用的鏈配置（而非全部）
// ❌ import * as chains from 'viem/chains'  // 導入所有 100+ 鏈
// ✅ import { mainnet, optimism } from 'viem/chains'  // 只導入 2 個
```

**Bundle size 對比**（minified + gzipped）：

| 配置 | Bundle Size |
|------|-------------|
| 全量導入 viem + wagmi | 145 KB |
| 按需導入 + tree shaking | 42 KB |
| 按需 + manualChunks | 38 KB |

## 總結：DApp 性能優化的完整清單

1. **RPC 請求優化**
   - 使用 Multicall3 批量讀取，將 N 次請求合併為 1 次
   - 多節點輪詢與故障轉移，避免單點故障
   - 請求去重和並發控制

2. **緩存策略**
   - 餘額數據：10-30 秒刷新
   - 合約只讀狀態：5-10 分鐘刷新
   - 交易後主動失效相關緩存

3. **索引服務**
   - 歷史數據查詢使用 The Graph 或自建索引
   - 實時數據使用 RPC + watchEvent
   - 複雜聚合查詢使用索引服務

4. **預加載**
   - 路由級數據預取
   - 懸停預加載關鍵頁面
   - 首屏關鍵路徑數據並行請求

5. **Bundle 優化**
   - viem/wagmi 按需導入
   - 只導入使用的鏈配置
   - manualChunks 分包

6. **性能監控**
   - 監控 RPC 請求延遲
   - 追蹤 FCP/LCP/TTI
   - 慢查詢告警

## 小結

DApp 性能優化的核心在於減少 RPC 請求數量和延遲。Multicall3 是最有效的手段，能將 N 次請求合併為 1 次。多節點池配合健康檢查確保高可用。SWR/React Query 的緩存策略防止重複請求，交易後主動失效保證數據新鮮。索引服務解決了歷史數據查詢的性能問題——直接從 RPC 遍歷事件日誌是不可行的。預加載策略讓用戶感知不到加載等待。Bundle 優化通過 tree-shaking 和分包實現。性能監控應該是持續的過程——DApp 的性能瓶頸會隨著鏈上活動和用戶增長而變化。建立完整的性能優化清單並持續迭代，是構建高性能 DApp 的必經之路。
