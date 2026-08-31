---
title: "Web3 DApp 性能优化：RPC 请求与链上数据缓存"
date: 2026-08-07 19:44:35
tags:
  - Web3
  - 性能优化
  - DApp
readingTime: 9
description: "系统性分析 DApp 性能瓶颈，涵盖 RPC 批量请求、多节点轮询、SWR 缓存策略、索引服务对比及 bundle 优化"
wordCount: 1212
---

## DApp 性能瓶颈分析：RPC 延迟是最大问题

DApp 的性能瓶颈与传统 Web 应用截然不同。传统应用的瓶颈通常在数据库查询或 API 响应，而 DApp 的首要瓶颈是 RPC 请求延迟。每次读取链上数据——余额、合约状态、事件日志——都需要一次完整的 RPC 往返，延迟通常在 100-500ms 之间，是传统 API 调用的 5-10 倍。

典型 DApp 首屏加载的 RPC 请求量：

```
页面加载时：
├── 获取当前区块号           (1 次 RPC)
├── 获取用户 ETH 余额         (1 次 RPC)
├── 获取用户代币余额 × N      (N 次 RPC)
├── 获取合约状态              (3-5 次 RPC)
├── 获取历史事件日志          (1-2 次 RPC)
├── 获取 Gas 价格             (1 次 RPC)
└── 获取链 ID 和网络信息       (1 次 RPC)
─────────────────────────────
总计：8-12 次 RPC 请求
串行延迟：800ms - 6000ms
```

如果这些请求串行执行，首屏加载时间将超过 3 秒。优化的核心目标是将串行转为并行，并减少请求总数。

## RPC 批量请求：Multicall 合约与 multicall.js

Multicall3 合约是最有效的 RPC 请求优化手段。它允许在一次调用中批量调用多个合约的多个函数，将 N 次 RPC 请求合并为 1 次：

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

  // 批量读取合约数据
  async batchRead<T extends readonly { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }[]>(
    calls: T,
  ): Promise<{ result: unknown; status: 'success' | 'failure'; error?: string }[]> {
    // 使用 viem 内置的 multicall
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

  // 实际使用：一次请求获取用户的所有代币余额
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

    // 还可以加入 ETH 余额查询
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

  // 使用 viem 内置 multicall（更简洁的 API）
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

**性能对比**：获取 10 个代币余额，串行需要 10 次 RPC（~2-5s），Multicall 只需 1 次（~200-400ms），提升约 10 倍。

## 多节点轮询与故障转移

单一 RPC 节点是单点故障。多节点轮询可以提高可用性和速度：

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

  // 获取最佳节点（延迟最低的健康节点）
  getBestNode(): string {
    const healthy = this.nodes.filter((n) => n.healthy)
    if (healthy.length === 0) {
      // 所有节点都不健康，重置并返回第一个
      this.nodes.forEach((n) => (n.healthy = true))
      return this.nodes[0].url
    }
    // 按延迟排序，选择最快的
    healthy.sort((a, b) => a.latency - b.latency)
    return healthy[0].url
  }

  // 轮询获取下一个节点
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

  // 带故障转移的请求
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
      signal: AbortSignal.timeout(10000), // 10 秒超时
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

  // 启动健康检查
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

// 使用：创建多节点连接池
const rpcPool = new RpcPool([
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
])
rpcPool.startHealthCheck()
```

## SWR / React Query 缓存策略

缓存是减少 RPC 请求的关键。SWR 和 React Query 是 React 生态中最流行的两个数据缓存库：

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
      revalidateOnFocus: false,     // 切回标签页时不自动刷新
      dedupingInterval: 10000,      // 10 秒内去重
      refreshInterval: 30000,       // 30 秒自动刷新
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
    staleTime: 10000,      // 10 秒内不重新请求
    gcTime: 300000,        // 5 分钟后清理缓存
    retry: 3,
    refetchOnWindowFocus: false,
  })
}

// 交易后自动刷新余额
function useSwapAndRefresh() {
  const queryClient = useQueryClient()

  const swap = async (tokenIn: Address, tokenOut: Address, amount: bigint) => {
    // 执行 swap 交易
    const hash = await executeSwap(tokenIn, tokenOut, amount)

    // 等待确认
    await waitForConfirmation(hash)

    // 刷新相关查询缓存
    await queryClient.invalidateQueries({
      queryKey: ['balance'],
    })
  }

  return { swap }
}
```

**缓存策略要点**：

- 余额数据：10-30 秒刷新一次（用户可能从其他地方收到转账）
- 合约只读状态：5-10 分钟刷新（变化频率低）
- 事件日志：不缓存或 1 分钟刷新
- 交易历史：用户操作后手动刷新

## 索引服务：The Graph vs 自建索引

直接从 RPC 查询历史事件效率极低——需要遍历区块，每个区块一次 RPC 调用。索引服务通过预先建立索引解决这个问题。

```typescript
// The Graph 查询
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

// 自建索引（使用 viem watchEvent + 本地数据库）
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

| 维度 | The Graph | 自建索引 |
|------|-----------|---------|
| 开发成本 | 低（写 GraphQL Schema） | 高（需要后端基础设施） |
| 查询灵活性 | 高（GraphQL） | 自定义 |
| 延迟 | 低（索引已完成） | 取决于同步状态 |
| 成本 | 按查询付费（GRT） | 服务器成本 |
| 去中心化 | 是 | 否 |
| 适合场景 | 通用 DApp | 特定高性能查询 |

## 预加载策略：路由级数据预取

在用户导航到页面之前预取数据，可以消除加载等待：

```typescript
import { prefetchQuery } from '@tanstack/react-query-prefetch'

// 路由级预取
async function prefetchPoolData(poolAddress: Address) {
  const queryClient = getQueryClient()

  // 并行预取所有需要的数据
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

// 在导航链接上悬停时预取
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

## 高性能 DApp 数据层

整合上述所有优化策略：

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

  // 批量获取首页数据
  async fetchDashboardData(userAddress: Address) {
    return this.queryClient.fetchQuery({
      queryKey: ['dashboard', userAddress],
      queryFn: async () => {
        // 使用 Multicall 一次获取所有数据
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
      staleTime: 15000, // 15 秒缓存
    })
  }

  // 节点故障时自动切换
  private async withFailover<T>(fn: (url: string) => Promise<T>): Promise<T> {
    const maxRetries = 3
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(this.rpcPool.getBestNode())
      } catch (error) {
        if (i === maxRetries - 1) throw error
        // 等待短暂时间后重试
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
    throw new Error('Unreachable')
  }
}
```

## 性能指标：FCP, LCP, TTI 在 DApp 中的特殊考量

DApp 在解读性能指标时与传统 Web 应用有所不同：

- **FCP (First Contentful Paint)**：DApp 应在 FCP 时展示骨架屏，不等待 RPC 响应
- **LCP (Largest Contentful Paint)**：关键链上数据（如代币余额）应在 2 秒内加载完成
- **TTI (Time to Interactive)**：DApp 的 TTI 受钱包连接状态影响，未连接时也应可交互

```typescript
// 性能监控
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

      // 上报到分析服务
      if (duration > 2000) {
        this.reportSlowQuery(key, duration)
      }
    }
  }

  private reportSlowQuery(key: string, duration: number) {
    // 上报慢查询
    analytics.track('slow_query', { key, duration })
  }
}

// 使用：在关键路径上测量
const perf = new DAppPerformanceMonitor()

async function loadDashboard(userAddress: Address) {
  perf.startMeasure('dashboard_load')
  const data = await dataLayer.fetchDashboardData(userAddress)
  perf.endMeasure('dashboard_load')
  return data
}
```

## 前端 bundle 优化：wagmi/viem 的 tree shaking

viem 和 wagmi v2 设计为 tree-shakable，但需要正确配置才能发挥优势：

```typescript
// ❌ 错误：导入整个库
import { viem } from 'viem' // 不存在，但类似的错误写法

// ✅ 正确：按需导入
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { useReadContract, useWriteContract } from 'wagmi'

// vite.config.ts 中的优化配置
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

// 只导入使用的链配置（而非全部）
// ❌ import * as chains from 'viem/chains'  // 导入所有 100+ 链
// ✅ import { mainnet, optimism } from 'viem/chains'  // 只导入 2 个
```

**Bundle size 对比**（minified + gzipped）：

| 配置 | Bundle Size |
|------|-------------|
| 全量导入 viem + wagmi | 145 KB |
| 按需导入 + tree shaking | 42 KB |
| 按需 + manualChunks | 38 KB |

## 总结：DApp 性能优化的完整清单

1. **RPC 请求优化**
   - 使用 Multicall3 批量读取，将 N 次请求合并为 1 次
   - 多节点轮询与故障转移，避免单点故障
   - 请求去重和并发控制

2. **缓存策略**
   - 余额数据：10-30 秒刷新
   - 合约只读状态：5-10 分钟刷新
   - 交易后主动失效相关缓存

3. **索引服务**
   - 历史数据查询使用 The Graph 或自建索引
   - 实时数据使用 RPC + watchEvent
   - 复杂聚合查询使用索引服务

4. **预加载**
   - 路由级数据预取
   - 悬停预加载关键页面
   - 首屏关键路径数据并行请求

5. **Bundle 优化**
   - viem/wagmi 按需导入
   - 只导入使用的链配置
   - manualChunks 分包

6. **性能监控**
   - 监控 RPC 请求延迟
   - 追踪 FCP/LCP/TTI
   - 慢查询告警

## 小结

DApp 性能优化的核心在于减少 RPC 请求数量和延迟。Multicall3 是最有效的手段，能将 N 次请求合并为 1 次。多节点池配合健康检查确保高可用。SWR/React Query 的缓存策略防止重复请求，交易后主动失效保证数据新鲜。索引服务解决了历史数据查询的性能问题——直接从 RPC 遍历事件日志是不可行的。预加载策略让用户感知不到加载等待。Bundle 优化通过 tree-shaking 和分包实现。性能监控应该是持续的过程——DApp 的性能瓶颈会随着链上活动和用户增长而变化。建立完整的性能优化清单并持续迭代，是构建高性能 DApp 的必经之路。
