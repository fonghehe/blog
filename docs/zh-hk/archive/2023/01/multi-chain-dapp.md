---
title: "多鏈 DApp 架構：跨鏈數據同步與狀態管理"
date: 2023-01-18 14:36:12
tags:
  - Web3
  - DApp
  - 架構
readingTime: 9
description: "2023 年的 Web3 已是多鏈世界。前端需要同時連接 Ethereum、Polygon、Arbitrum、Optimism、BSC 等多條鏈。本文系統拆解多鏈 DApp 的架構設計、狀態管理和跨鏈數據同步方案。"
wordCount: 870
---

以太坊主網不再是 DApp 的唯一部署目標。Gas 費用高企和擴容需求推動了 Layer 2 和側鏈的爆發式增長。一個典型的 DeFi 協議現在需要同時部署到 Ethereum、Polygon、Arbitrum、Optimism、BSC 至少 5 條鏈上。多鏈部署帶來的前端架構挑戰是根本性的：如何管理不同鏈上的不同合約地址、如何處理用户的鏈切換、如何同步跨鏈狀態。

## 多鏈生態現狀

主流部署鏈及其特點：

| 鏈 | Chain ID | 類型 | 特點 |
|----|----------|------|------|
| Ethereum | 1 | L1 | 安全性最高，Gas 最貴 |
| Polygon | 137 | 側鏈 | 低 Gas，PoS 共識 |
| Arbitrum | 42161 | OR L2 | EVM 等效，低 Gas |
| Optimism | 10 | OR L2 | EVM 等效，低 Gas |
| BSC | 56 | L1 | 幣安生態，低 Gas |
| Avalanche | 43114 | L1 | 子網架構 |
| Base | 8453 | OR L2 | Coinbase 生態 |

每條鏈有自己的 RPC 端點、區塊瀏覽器、合約地址和確認時間。多鏈 DApp 的前端必須能夠靈活地在這些鏈之間切換。

## 多鏈 DApp 的架構挑戰

### 核心挑戰

1. **合約地址管理**：同一合約在不同鏈上地址不同（因為 CREATE2 nonce 或部署者不同）
2. **RPC 管理器**：需要維護多個 RPC 連接，處理超時和故障轉移
3. **狀態管理**：當前選中的鏈、鏈切換事件、跨鏈資產狀態
4. **用户引導**：網絡切換的 UX、不支持鏈的提示
5. **跨鏈數據同步**：同一用户在不同鏈上的資產聚合

### 架構分層

```
┌─────────────────────────────────────┐
│           UI Layer (React)          │
├─────────────────────────────────────┤
│         State Management            │
│  (current chain, multi-chain state) │
├─────────────────────────────────────┤
│         Chain Manager               │
│  (RPC pool, provider switching)     │
├─────────────────────────────────────┤
│      Contract Registry              │
│  (per-chain addresses, ABIs)        │
├─────────────────────────────────────┤
│        Chain Config                 │
│  (chain metadata, RPC URLs)         │
└─────────────────────────────────────┘
```

## 合約地址管理

### 鏈配置註冊表

```typescript
// config/chains.ts
export interface ChainConfig {
  chainId: number
  name: string
  shortName: string
  rpcUrls: string[]        // 多個 RPC 用於故障轉移
  blockExplorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet: boolean
  // 鏈特定參數
  confirmationBlocks: number
  blockTimeMs: number
}

export const CHAINS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'eth',
    rpcUrls: [
      'https://eth-mainnet.alchemyapi.io/v2/KEY',
      'https://mainnet.infura.io/v3/KEY',
      'https://cloudflare-eth.com',  // 公共備用
    ],
    blockExplorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
    confirmationBlocks: 12,
    blockTimeMs: 12000,
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    shortName: 'matic',
    rpcUrls: [
      'https://polygon-mainnet.alchemyapi.io/v2/KEY',
      'https://polygon-rpc.com',
    ],
    blockExplorerUrl: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: false,
    confirmationBlocks: 20,
    blockTimeMs: 2000,
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'arb',
    rpcUrls: [
      'https://arb-mainnet.alchemyapi.io/v2/KEY',
      'https://arb1.arbitrum.io/rpc',
    ],
    blockExplorerUrl: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
    confirmationBlocks: 5,
    blockTimeMs: 1300,
  },
  10: {
    chainId: 10,
    name: 'Optimism',
    shortName: 'op',
    rpcUrls: [
      'https://opt-mainnet.alchemyapi.io/v2/KEY',
      'https://mainnet.optimism.io',
    ],
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
    confirmationBlocks: 1,
    blockTimeMs: 2000,
  },
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    shortName: 'bsc',
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://bsc.publicnode.com',
    ],
    blockExplorerUrl: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: false,
    confirmationBlocks: 12,
    blockTimeMs: 3000,
  },
}

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number)
```

### 合約地址註冊表

```typescript
// config/contracts.ts
import { CHAINS } from './chains'

// 每個合約在各鏈上的地址
export interface ContractDeployment {
  address: string
  abi: any[]
  // 可選：部署區塊號（用於事件查詢優化）
  startBlock?: number
}

export const CONTRACTS = {
  // 交易協議合約
  Exchange: {
    1: { address: '0xExchangeMainnet...', abi: exchangeAbi, startBlock: 15000000 },
    137: { address: '0xExchangePolygon...', abi: exchangeAbi, startBlock: 38000000 },
    42161: { address: '0xExchangeArb...', abi: exchangeAbi, startBlock: 100000 },
    10: { address: '0xExchangeOp...', abi: exchangeAbi, startBlock: 500000 },
    56: { address: '0xExchangeBSC...', abi: exchangeAbi, startBlock: 25000000 },
  },
  // 代幣合約
  Token: {
    1: { address: '0xTokenMainnet...', abi: erc20Abi, startBlock: 14000000 },
    137: { address: '0xTokenPolygon...', abi: erc20Abi, startBlock: 35000000 },
    42161: { address: '0xTokenArb...', abi: erc20Abi, startBlock: 80000 },
    10: { address: '0xTokenOp...', abi: erc20Abi, startBlock: 450000 },
    56: { address: '0xTokenBSC...', abi: erc20Abi, startBlock: 24000000 },
  },
} as const

export type ContractName = keyof typeof CONTRACTS

export function getContractConfig(
  contractName: ContractName,
  chainId: number
): ContractDeployment {
  const deployments = CONTRACTS[contractName]
  const deployment = deployments[chainId]

  if (!deployment) {
    throw new Error(
      `Contract ${contractName} not deployed on chain ${chainId}`
    )
  }

  return deployment
}
```

## RPC 管理器

多鏈場景下需要維護多個 Provider，並處理 RPC 超時、故障轉移和併發請求。

```typescript
// lib/RpcManager.ts
import { ethers } from 'ethers'
import { ChainConfig, CHAINS } from '../config/chains'

export class RpcManager {
  private providers = new Map<number, ethers.providers.FallbackProvider>()
  private readonly timeout = 10000 // 10 秒超時

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    for (const [chainIdStr, config] of Object.entries(CHAINS)) {
      const chainId = Number(chainIdStr)
      const providers = config.rpcUrls.map(
        (url) => new ethers.providers.StaticJsonRpcProvider(url, chainId)
      )

      if (providers.length === 1) {
        // 單 RPC 時直接使用
        this.providers.set(chainId, providers[0] as any)
      } else {
        // 多 RPC 時使用 FallbackProvider
        const fallbackProvider = new ethers.providers.FallbackProvider(
          providers.map((p, i) => ({
            provider: p,
            priority: i,
            weight: providers.length - i,
            stallTimeout: this.timeout,
          })),
          1 // quorum
        )
        this.providers.set(chainId, fallbackProvider)
      }
    }
  }

  getProvider(chainId: number): ethers.providers.Provider {
    const provider = this.providers.get(chainId)
    if (!provider) {
      throw new Error(`No provider for chain ${chainId}`)
    }
    return provider
  }

  // 併發請求多個鏈
  async multiChainCall<T>(
    chainIds: number[],
    fn: (chainId: number, provider: ethers.providers.Provider) => Promise<T>
  ): Promise<Record<number, T>> {
    const entries = await Promise.all(
      chainIds.map(async (chainId) => {
        try {
          const provider = this.getProvider(chainId)
          const result = await fn(chainId, provider)
          return [chainId, result] as const
        } catch (error) {
          console.error(`Chain ${chainId} request failed:`, error)
          return [chainId, null] as const
        }
      })
    )

    return Object.fromEntries(entries)
  }
}
```

## 前端狀態管理

### 多鏈狀態管理

```typescript
// store/multiChainStore.ts
import { create } from 'zustand'
import { ethers } from 'ethers'
import { CHAINS, SUPPORTED_CHAIN_IDS } from '../config/chains'
import { RpcManager } from '../lib/RpcManager'

interface MultiChainState {
  // 當前選中的鏈
  currentChainId: number
  // 錢包連接的鏈（可能與選中鏈不同）
  walletChainId: number | null
  // 賬户地址
  account: string | null
  // 各鏈的資產餘額
  balances: Record<number, Record<string, string>>
  // 加載狀態
  isLoadingBalances: boolean
  // RPC 管理器
  rpcManager: RpcManager

  // Actions
  setCurrentChain: (chainId: number) => void
  setWalletChain: (chainId: number) => void
  setAccount: (account: string | null) => void
  fetchBalances: (account: string) => Promise<void>
  switchChain: (chainId: number) => Promise<void>
}

export const useMultiChainStore = create<MultiChainState>((set, get) => ({
  currentChainId: 1, // 默認 Ethereum
  walletChainId: null,
  account: null,
  balances: {},
  isLoadingBalances: false,
  rpcManager: new RpcManager(),

  setCurrentChain: (chainId) => {
    if (!CHAINS[chainId]) {
      console.error(`Unsupported chain: ${chainId}`)
      return
    }
    set({ currentChainId: chainId })
  },

  setWalletChain: (chainId) => set({ walletChainId: chainId }),

  setAccount: (account) => set({ account }),

  fetchBalances: async (account) => {
    set({ isLoadingBalances: true })
    try {
      const { rpcManager } = get()
      const results = await rpcManager.multiChainCall(
        SUPPORTED_CHAIN_IDS,
        async (chainId, provider) => {
          // 獲取原生代幣餘額
          const balance = await provider.getBalance(account)
          return { native: ethers.utils.formatEther(balance) }
        }
      )
      set({ balances: results })
    } finally {
      set({ isLoadingBalances: false })
    }
  },

  switchChain: async (chainId) => {
    const config = CHAINS[chainId]
    if (!config) throw new Error(`Unsupported chain: ${chainId}`)

    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + chainId.toString(16) }],
        })
        set({ currentChainId: chainId, walletChainId: chainId })
      } catch (switchError: any) {
        // 鏈未添加到錢包
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x' + chainId.toString(16),
                chainName: config.name,
                rpcUrls: config.rpcUrls,
                nativeCurrency: config.nativeCurrency,
                blockExplorerUrls: [config.blockExplorerUrl],
              },
            ],
          })
          set({ currentChainId: chainId, walletChainId: chainId })
        } else {
          throw switchError
        }
      }
    } else {
      // 無錢包時只切換 UI 鏈
      set({ currentChainId: chainId })
    }
  },
}))
```

### 鏈切換 Hook

```typescript
// hooks/useChainSwitch.ts
import { useEffect } from 'react'
import { useMultiChainStore } from '../store/multiChainStore'

export function useChainSwitch() {
  const { currentChainId, walletChainId, switchChain, fetchBalances, account } =
    useMultiChainStore()

  // 監聽錢包鏈切換
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16)
      useMultiChainStore.getState().setWalletChain(newChainId)
      // 如果錢包切換了鏈，同步 UI
      useMultiChainStore.getState().setCurrentChain(newChainId)

      // 重新獲取餘額
      if (account) {
        fetchBalances(account)
      }
    }

    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [account, fetchBalances])

  const isWrongChain = walletChainId !== null && walletChainId !== currentChainId

  return {
    currentChainId,
    walletChainId,
    isWrongChain,
    switchChain,
  }
}
```

## 跨鏈數據同步策略

### 資產聚合視圖

用户在多條鏈上持有資產，前端需要聚合展示：

```typescript
// hooks/useCrossChainAssets.ts
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useMultiChainStore } from '../store/multiChainStore'
import { SUPPORTED_CHAIN_IDS, CHAINS } from '../config/chains'
import { getContractConfig } from '../config/contracts'

interface AssetAggregation {
  chainId: number
  chainName: string
  nativeBalance: string
  tokenBalance: string
  totalUsd: number
}

export function useCrossChainAssets(account: string | null) {
  const [assets, setAssets] = useState<AssetAggregation[]>([])
  const [loading, setLoading] = useState(false)
  const { rpcManager } = useMultiChainStore()

  useEffect(() => {
    if (!account) {
      setAssets([])
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchAllChains() {
      const results = await Promise.allSettled(
        SUPPORTED_CHAIN_IDS.map(async (chainId) => {
          const provider = rpcManager.getProvider(chainId)

          // 原生餘額
          const nativeBalance = await provider.getBalance(account)

          // Token 餘額（如果合約部署在該鏈上）
          let tokenBalance = ethers.BigNumber.from(0)
          try {
            const { address, abi } = getContractConfig('Token', chainId)
            const contract = new ethers.Contract(address, abi, provider)
            tokenBalance = await contract.balanceOf(account)
          } catch {
            // 合約可能未部署在該鏈上
          }

          return {
            chainId,
            chainName: CHAINS[chainId].name,
            nativeBalance: ethers.utils.formatEther(nativeBalance),
            tokenBalance: ethers.utils.formatEther(tokenBalance),
            totalUsd: 0, // 需要價格 API
          }
        })
      )

      if (!cancelled) {
        const successful = results
          .filter(
            (r): r is PromiseFulfilledResult<AssetAggregation> =>
              r.status === 'fulfilled'
          )
          .map((r) => r.value)

        setAssets(successful)
        setLoading(false)
      }
    }

    fetchAllChains()

    // 每 30 秒刷新
    const interval = setInterval(fetchAllChains, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [account, rpcManager])

  // 聚合總餘額
  const totalNative = assets.reduce(
    (sum, a) => sum + parseFloat(a.nativeBalance),
    0
  )

  return { assets, totalNative, loading }
}
```

## 跨鏈橋前端集成

```typescript
// components/CrossChainBridge.tsx
import { useState } from 'react'
import { useMultiChainStore } from '../store/multiChainStore'
import { CHAINS, SUPPORTED_CHAIN_IDS } from '../config/chains'

export function CrossChainBridge() {
  const { currentChainId, switchChain } = useMultiChainStore()
  const [fromChain, setFromChain] = useState(currentChainId)
  const [toChain, setToChain] = useState(42161)
  const [amount, setAmount] = useState('')

  const handleBridge = async () => {
    if (fromChain === toChain) {
      alert('源鏈和目標鏈不能相同')
      return
    }

    // 確保錢包在源鏈上
    if (currentChainId !== fromChain) {
      await switchChain(fromChain)
    }

    // 根據鏈對選擇橋
    const bridge = selectBridge(fromChain, toChain)
    await bridge.transfer(amount, toChain)
  }

  return (
    <div className="bridge-container">
      <div className="chain-selector">
        <label>從</label>
        <select
          value={fromChain}
          onChange={(e) => setFromChain(Number(e.target.value))}
        >
          {SUPPORTED_CHAIN_IDS.map((id) => (
            <option key={id} value={id}>
              {CHAINS[id].name}
            </option>
          ))}
        </select>
      </div>

      <div className="chain-selector">
        <label>到</label>
        <select
          value={toChain}
          onChange={(e) => setToChain(Number(e.target.value))}
        >
          {SUPPORTED_CHAIN_IDS.filter((id) => id !== fromChain).map((id) => (
            <option key={id} value={id}>
              {CHAINS[id].name}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="轉賬金額"
      />

      <button onClick={handleBridge}>跨鏈轉賬</button>
    </div>
  )
}

function selectBridge(fromChain: number, toChain: number) {
  // 根據鏈對選擇最優橋
  if (fromChain === 1 && (toChain === 10 || toChain === 42161)) {
    return new OfficialBridge(toChain) // 官方橋
  }
  return new ThirdPartyBridge(fromChain, toChain) // 第三方橋
}
```

## 鏈 ID 檢測與網絡切換 UX

```typescript
// components/NetworkGuard.tsx
import { useMultiChainStore } from '../store/multiChainStore'
import { CHAINS } from '../config/chains'

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { walletChainId, currentChainId, switchChain } = useMultiChainStore()

  // 錢包未連接
  if (walletChainId === null) {
    return <>{children}</>
  }

  // 錢包鏈與當前選中鏈不匹配
  if (walletChainId !== currentChainId) {
    return (
      <div className="network-warning">
        <h3>網絡不匹配</h3>
        <p>
          當前頁面需要 <strong>{CHAINS[currentChainId].name}</strong>，
          但你的錢包連接到了{' '}
          <strong>{CHAINS[walletChainId]?.name || '未知鏈'}</strong>
        </p>
        <button onClick={() => switchChain(currentChainId)}>
          切換到 {CHAINS[currentChainId].name}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

### 鏈選擇器組件

```tsx
// components/ChainSelector.tsx
import { useMultiChainStore } from '../store/multiChainStore'
import { CHAINS, SUPPORTED_CHAIN_IDS } from '../config/chains'

export function ChainSelector() {
  const { currentChainId, walletChainId, switchChain } = useMultiChainStore()

  return (
    <div className="chain-selector">
      {SUPPORTED_CHAIN_IDS.map((chainId) => {
        const config = CHAINS[chainId]
        const isActive = currentChainId === chainId
        const isWalletConnected = walletChainId === chainId

        return (
          <button
            key={chainId}
            className={`chain-button ${isActive ? 'active' : ''}`}
            onClick={() => switchChain(chainId)}
          >
            <ChainIcon chainId={chainId} />
            <span>{config.shortName.toUpperCase()}</span>
            {isWalletConnected && <span className="dot" />}
          </button>
        )
      })}
    </div>
  )
}
```

## 性能考量：多鏈 RPC 併發請求

多鏈場景下，前端經常需要同時向多條鏈發起 RPC 請求。如果不加以控制，會導致性能問題。

```typescript
// lib/concurrentMultiChain.ts
import { SUPPORTED_CHAIN_IDS } from '../config/chains'

// 併發限制器
class ConcurrencyLimiter {
  private queue: (() => Promise<void>)[] = []
  private active = 0
  private maxConcurrent: number

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.active++
        try {
          const result = await task()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.active--
          if (this.queue.length > 0) {
            this.queue.shift()!()
          }
        }
      }

      if (this.active < this.maxConcurrent) {
        execute()
      } else {
        this.queue.push(execute)
      }
    })
  }
}

// 批量查詢多鏈餘額（帶併發控制）
async function batchQueryBalances(
  account: string,
  rpcManager: RpcManager
) {
  const limiter = new ConcurrencyLimiter(3) // 最多 3 個併發

  const results = await Promise.allSettled(
    SUPPORTED_CHAIN_IDS.map((chainId) =>
      limiter.run(async () => {
        const provider = rpcManager.getProvider(chainId)
        const balance = await provider.getBalance(account)
        return { chainId, balance }
      })
    )
  )

  return results
}
```

### 請求緩存與去重

```typescript
// lib/cache.ts
import { ethers } from 'ethers'

class RequestCache {
  private cache = new Map<string, { value: any; expiry: number }>()
  private pending = new Map<string, Promise<any>>()

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 30000
  ): Promise<T> {
    // 檢查緩存
    const cached = this.cache.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.value
    }

    // 去重：如果相同請求正在進行中，複用
    if (this.pending.has(key)) {
      return this.pending.get(key)!
    }

    const promise = fetcher().then((value) => {
      this.cache.set(key, { value, expiry: Date.now() + ttlMs })
      this.pending.delete(key)
      return value
    })

    this.pending.set(key, promise)
    return promise
  }
}

// 使用
const cache = new RequestCache()

async function getBalanceWithCache(
  account: string,
  chainId: number,
  rpcManager: RpcManager
) {
  return cache.get(
    `balance:${chainId}:${account}`,
    async () => {
      const provider = rpcManager.getProvider(chainId)
      return provider.getBalance(account)
    },
    15000 // 15 秒緩存
  )
}
```

## 小結

多鏈 DApp 架構的核心在於"配置驅動 + 統一抽象"。通過集中管理鏈配置和合約地址註冊表，前端可以在不同鏈之間靈活切換而無需硬編碼。RPC 管理器負責故障轉移和併發控制，狀態管理器處理鏈切換和跨鏈數據聚合。

跨鏈橋的集成是多鏈 DApp 的關鍵組件。前端需要根據鏈對選擇最優橋（官方橋 vs 第三方橋），並處理橋的不同交互模式（即時到賬 vs 延遲到賬）。這部分邏輯的複雜度不容低估。

性能方面，多鏈 RPC 併發請求是主要瓶頸。併發限制器、請求緩存和去重是三個關鍵優化手段。實際項目中建議使用 `Promise.allSettled` 而非 `Promise.all`，確保單鏈請求失敗不影響其他鏈的數據獲取。

隨着鏈數量的持續增長，多鏈架構設計的重要性日益提升。前端框架和工具鏈（如 wagmi v2 的多鏈 Provider）也在快速演進，但核心的架構原則不變：配置化、抽象化、防禦性編程。
