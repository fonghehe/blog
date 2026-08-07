---
title: "Web3 DApp Performance Optimization: RPC Requests and On-Chain Data Caching"
date: 2026-08-07 19:44:35
tags:
  - Web3
  - 性能优化
  - DApp
readingTime: 8
description: "Systematic analysis of DApp performance bottlenecks, covering RPC batch requests, multi-node polling, SWR caching strategies, indexing service comparison, and bundle optimization"
wordCount: 3600
---

## DApp Performance Bottleneck Analysis: RPC Latency Is the Biggest Problem

DApp performance bottlenecks are fundamentally different from traditional web applications. Traditional app bottlenecks are typically database queries or API responses, while DApp's primary bottleneck is RPC request latency. Each on-chain data read—balance, contract state, event logs—requires a full RPC round trip, typically 100-500ms, 5-10x slower than traditional API calls.

Typical RPC request volume for DApp first screen load:

```
Page load:
├── Get current block number        (1 RPC)
├── Get user ETH balance             (1 RPC)
├── Get user token balances × N      (N RPCs)
├── Get contract state               (3-5 RPCs)
├── Get historical event logs        (1-2 RPCs)
├── Get gas price                    (1 RPC)
└── Get chain ID and network info    (1 RPC)
──────────────────────────────────────
Total: 8-12 RPC requests
Serial latency: 800ms - 6000ms
```

If these requests execute serially, first screen load time exceeds 3 seconds. The core optimization goal is to convert serial to parallel and reduce total request count.

## RPC Batch Requests: Multicall Contract and multicall.js

The Multicall3 contract is the most effective RPC request optimization tool. It allows calling multiple functions across multiple contracts in a single transaction, merging N RPC requests into 1:

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

  // Batch read contract data
  async batchRead<T extends readonly { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }[]>(
    calls: T,
  ): Promise<{ result: unknown; status: 'success' | 'failure'; error?: string }[]> {
    // Use viem's built-in multicall
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

  // Practical use: fetch all token balances in one request
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

    // Can also add ETH balance query
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

  // Using viem's built-in multicall (cleaner API)
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

**Performance comparison**: Fetching 10 token balances serially requires 10 RPCs (~2-5s), Multicall requires only 1 (~200-400ms), a ~10x improvement.

## Multi-Node Polling and Failover

A single RPC node is a single point of failure. Multi-node polling improves availability and speed:

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

  // Get best node (lowest latency healthy node)
  getBestNode(): string {
    const healthy = this.nodes.filter((n) => n.healthy)
    if (healthy.length === 0) {
      // All nodes unhealthy, reset and return first
      this.nodes.forEach((n) => (n.healthy = true))
      return this.nodes[0].url
    }
    // Sort by latency, pick fastest
    healthy.sort((a, b) => a.latency - b.latency)
    return healthy[0].url
  }

  // Round-robin get next node
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

  // Request with failover
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
      signal: AbortSignal.timeout(10000), // 10s timeout
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

  // Start health check
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

// Usage: create multi-node connection pool
const rpcPool = new RpcPool([
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
])
rpcPool.startHealthCheck()
```

## SWR / React Query Caching Strategies

Caching is key to reducing RPC requests. SWR and React Query are the two most popular data caching libraries in the React ecosystem:

```typescript
import useSWR from 'swr'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// SWR approach
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
      revalidateOnFocus: false,     // Don't auto-refresh on tab focus
      dedupingInterval: 10000,      // Deduplicate within 10s
      refreshInterval: 30000,       // Auto-refresh every 30s
      errorRetryCount: 3,
    },
  )
}

// React Query approach
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
    staleTime: 10000,      // Don't re-request within 10s
    gcTime: 300000,        // Clean up cache after 5 min
    retry: 3,
    refetchOnWindowFocus: false,
  })
}

// Auto-refresh balance after transaction
function useSwapAndRefresh() {
  const queryClient = useQueryClient()

  const swap = async (tokenIn: Address, tokenOut: Address, amount: bigint) => {
    // Execute swap transaction
    const hash = await executeSwap(tokenIn, tokenOut, amount)

    // Wait for confirmation
    await waitForConfirmation(hash)

    // Invalidate related query cache
    await queryClient.invalidateQueries({
      queryKey: ['balance'],
    })
  }

  return { swap }
}
```

**Caching strategy key points**:

- Balance data: refresh every 10-30s (user may receive transfers elsewhere)
- Contract read-only state: refresh every 5-10 min (low change frequency)
- Event logs: no cache or refresh every 1 min
- Transaction history: manual refresh after user action

## Indexing Services: The Graph vs Self-Built Index

Querying historical events directly from RPC is extremely inefficient—requires iterating blocks, one RPC call per block. Indexing services solve this by pre-building indexes.

```typescript
// The Graph query
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

// Self-built index (using viem watchEvent + local database)
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

**The Graph vs Self-Built Index**:

| Dimension | The Graph | Self-Built Index |
|-----------|-----------|------------------|
| Development cost | Low (write GraphQL Schema) | High (needs backend infrastructure) |
| Query flexibility | High (GraphQL) | Custom |
| Latency | Low (indexing complete) | Depends on sync state |
| Cost | Pay per query (GRT) | Server cost |
| Decentralized | Yes | No |
| Suitable for | General DApps | Specific high-performance queries |

## Preloading Strategy: Route-Level Data Prefetching

Pre-fetching data before user navigates to a page eliminates loading wait:

```typescript
import { prefetchQuery } from '@tanstack/react-query-prefetch'

// Route-level prefetch
async function prefetchPoolData(poolAddress: Address) {
  const queryClient = getQueryClient()

  // Parallel prefetch all needed data
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

// Prefetch on link hover
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

## High-Performance DApp Data Layer

Integrating all optimization strategies:

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

  // Batch fetch dashboard data
  async fetchDashboardData(userAddress: Address) {
    return this.queryClient.fetchQuery({
      queryKey: ['dashboard', userAddress],
      queryFn: async () => {
        // Use Multicall to fetch all data in one go
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
      staleTime: 15000, // 15s cache
    })
  }

  // Auto-switch on node failure
  private async withFailover<T>(fn: (url: string) => Promise<T>): Promise<T> {
    const maxRetries = 3
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(this.rpcPool.getBestNode())
      } catch (error) {
        if (i === maxRetries - 1) throw error
        // Wait briefly before retry
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
    throw new Error('Unreachable')
  }
}
```

## Performance Metrics: FCP, LCP, TTI Special Considerations in DApps

DApp performance metrics have special considerations:

- **FCP (First Contentful Paint)**: DApp should show skeleton screen at FCP, not wait for RPC responses
- **LCP (Largest Contentful Paint)**: Critical on-chain data (e.g., token balances) should load within 2 seconds
- **TTI (Time to Interactive)**: DApp TTI is affected by wallet connection state; should be interactive even when disconnected

```typescript
// Performance monitoring
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

      // Report to analytics service
      if (duration > 2000) {
        this.reportSlowQuery(key, duration)
      }
    }
  }

  private reportSlowQuery(key: string, duration: number) {
    // Report slow query
    analytics.track('slow_query', { key, duration })
  }
}

// Usage: measure critical paths
const perf = new DAppPerformanceMonitor()

async function loadDashboard(userAddress: Address) {
  perf.startMeasure('dashboard_load')
  const data = await dataLayer.fetchDashboardData(userAddress)
  perf.endMeasure('dashboard_load')
  return data
}
```

## Frontend Bundle Optimization: wagmi/viem Tree Shaking

viem and wagmi v2 are designed to be tree-shakable, but need proper configuration:

```typescript
// ❌ Wrong: import entire library
import { viem } from 'viem' // Doesn't exist, but similar mistake

// ✅ Correct: import on demand
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { useReadContract, useWriteContract } from 'wagmi'

// Optimization config in vite.config.ts
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

// Only import used chain configs (not all)
// ❌ import * as chains from 'viem/chains'  // Imports all 100+ chains
// ✅ import { mainnet, optimism } from 'viem/chains'  // Only imports 2
```

**Bundle size comparison** (minified + gzipped):

| Configuration | Bundle Size |
|---------------|-------------|
| Full import viem + wagmi | 145 KB |
| On-demand import + tree shaking | 42 KB |
| On-demand + manualChunks | 38 KB |

## Summary: Complete DApp Performance Optimization Checklist

1. **RPC Request Optimization**
   - Use Multicall3 for batch reads, merging N requests into 1
   - Multi-node polling with failover to avoid single point of failure
   - Request deduplication and concurrency control

2. **Caching Strategy**
   - Balance data: refresh every 10-30s
   - Contract read-only state: refresh every 5-10 min
   - Actively invalidate related cache after transactions

3. **Indexing Services**
   - Use The Graph or self-built index for historical data queries
   - Use RPC + watchEvent for real-time data
   - Use indexing services for complex aggregation queries

4. **Preloading**
   - Route-level data prefetching
   - Hover-prefetch key pages
   - Parallel requests for first screen critical path data

5. **Bundle Optimization**
   - On-demand imports for viem/wagmi
   - Only import used chain configs
   - manualChunks for code splitting

6. **Performance Monitoring**
   - Monitor RPC request latency
   - Track FCP/LCP/TTI
   - Slow query alerts

## Summary

The core of DApp performance optimization lies in reducing RPC request count and latency. Multicall3 is the most effective tool, merging N requests into 1. Multi-node pools with health checks ensure high availability. SWR/React Query caching strategies prevent duplicate requests, with active invalidation after transactions ensuring data freshness. Indexing services solve the performance problem of historical data queries—iterating event logs directly from RPC is not feasible. Preloading strategies make loading waits imperceptible to users. Bundle optimization is achieved through tree-shaking and code splitting. Performance monitoring should be a continuous process—DApp performance bottlenecks change as on-chain activity and user base grow. Building a complete performance optimization checklist and continuously iterating is the path to building high-performance DApps.
