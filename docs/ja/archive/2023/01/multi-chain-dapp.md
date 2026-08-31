---
title: "マルチチェーン DApp アーキテクチャ：クロスチェーンデータ同期と状態管理"
date: 2023-01-18 14:36:12
tags:
  - Web3
  - DApp
  - アーキテクチャ
readingTime: 12
description: "2023年の Web3 はマルチチェーンの世界です。フロントエンドは Ethereum、Polygon、Arbitrum、Optimism、BSC など複数のチェーンに同時に接続する必要があります。本記事ではマルチチェーン DApp のアーキテクチャ設計、状態管理、クロスチェーンデータ同期方案を体系的に分解します。"
wordCount: 1660
---

Ethereum メインネットはもはや DApp の唯一のデプロイ先ではありません。Gas 費用の高騰とスケーリングの必要性が Layer 2 とサイドチェーンの爆発的成長を推進しました。典型的な DeFi プロトコルは現在、Ethereum、Polygon、Arbitrum、Optimism、BSC の少なくとも5つのチェーンに同時にデプロイする必要があります。マルチチェーンデプロイがもたらすフロントエンドアーキテクチャの課題は根本的なものです：異なるチェーン上の異なるコントラクトアドレスの管理、ユーザーのチェーン切り替えの処理、クロスチェーン状態の同期をどう行うか。

## マルチチェーンエコシステムの現状

主要デプロイチェーンとその特徴：

| チェーン | Chain ID | タイプ | 特徴 |
|----|----------|------|------|
| Ethereum | 1 | L1 | 最高の安全性、最も高い Gas |
| Polygon | 137 | サイドチェーン | 低 Gas、PoS コンセンサス |
| Arbitrum | 42161 | OR L2 | EVM 等価、低 Gas |
| Optimism | 10 | OR L2 | EVM 等価、低 Gas |
| BSC | 56 | L1 | Binance エコシステム、低 Gas |
| Avalanche | 43114 | L1 | サブネットアーキテクチャ |
| Base | 8453 | OR L2 | Coinbase エコシステム（ローンチ予定） |

各チェーンには独自の RPC エンドポイント、ブロックエクスプローラー、コントラクトアドレス、確認時間があります。マルチチェーン DApp のフロントエンドはこれらのチェーン間で柔軟に切り替えできなければなりません。

## マルチチェーン DApp のアーキテクチャの課題

### 主要な課題

1. **コントラクトアドレス管理**：同一コントラクトが異なるチェーンで異なるアドレスを持つ（CREATE2 nonce やデプロイヤーが異なるため）
2. **RPC マネージャー**：複数の RPC 接続を保守し、タイムアウトとフェイルオーバーを処理
3. **状態管理**：現在選択中のチェーン、チェーン切り替えイベント、クロスチェーン資産状態
4. **ユーザーガイド**：ネットワーク切り替えの UX、サポート外チェーンの提示
5. **クロスチェーンデータ同期**：同一ユーザーの異なるチェーン上の資産集約

### アーキテクチャの階層化

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

## コントラクトアドレス管理

### チェーン設定レジストリ

```typescript
// config/chains.ts
export interface ChainConfig {
  chainId: number
  name: string
  shortName: string
  rpcUrls: string[]        // フェイルオーバー用の複数 RPC
  blockExplorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet: boolean
  // チェーン固有パラメータ
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
      'https://cloudflare-eth.com',  // パブリックバックアップ
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

### コントラクトアドレスレジストリ

```typescript
// config/contracts.ts
import { CHAINS } from './chains'

// 各コントラクトの各チェーン上のアドレス
export interface ContractDeployment {
  address: string
  abi: any[]
  // オプション：デプロイブロック番号（イベント照会最適化用）
  startBlock?: number
}

export const CONTRACTS = {
  // 取引プロトコルコントラクト
  Exchange: {
    1: { address: '0xExchangeMainnet...', abi: exchangeAbi, startBlock: 15000000 },
    137: { address: '0xExchangePolygon...', abi: exchangeAbi, startBlock: 38000000 },
    42161: { address: '0xExchangeArb...', abi: exchangeAbi, startBlock: 100000 },
    10: { address: '0xExchangeOp...', abi: exchangeAbi, startBlock: 500000 },
    56: { address: '0xExchangeBSC...', abi: exchangeAbi, startBlock: 25000000 },
  },
  // トークンコントラクト
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

## RPC マネージャー

マルチチェーン環境では複数の Provider を保守し、RPC タイムアウト、フェイルオーバー、並行リクエストを処理する必要があります。

```typescript
// lib/RpcManager.ts
import { ethers } from 'ethers'
import { ChainConfig, CHAINS } from '../config/chains'

export class RpcManager {
  private providers = new Map<number, ethers.providers.FallbackProvider>()
  private readonly timeout = 10000 // 10 秒タイムアウト

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
        // 単一 RPC の場合はそのまま使用
        this.providers.set(chainId, providers[0] as any)
      } else {
        // 複数 RPC の場合は FallbackProvider を使用
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

  // 複数チェーンへの並行リクエスト
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

## フロントエンド状態管理

### マルチチェーン状態管理

```typescript
// store/multiChainStore.ts
import { create } from 'zustand'
import { ethers } from 'ethers'
import { CHAINS, SUPPORTED_CHAIN_IDS } from '../config/chains'
import { RpcManager } from '../lib/RpcManager'

interface MultiChainState {
  // 現在選択中のチェーン
  currentChainId: number
  // ウォレットが接続中のチェーン（選択中チェーンと異なる場合あり）
  walletChainId: number | null
  // アカウントアドレス
  account: string | null
  // 各チェーンの資産残高
  balances: Record<number, Record<string, string>>
  // ローディング状態
  isLoadingBalances: boolean
  // RPC マネージャー
  rpcManager: RpcManager

  // Actions
  setCurrentChain: (chainId: number) => void
  setWalletChain: (chainId: number) => void
  setAccount: (account: string | null) => void
  fetchBalances: (account: string) => Promise<void>
  switchChain: (chainId: number) => Promise<void>
}

export const useMultiChainStore = create<MultiChainState>((set, get) => ({
  currentChainId: 1, // デフォルト Ethereum
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
          // ネイティブトークン残高の取得
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
        // チェーンがウォレットに追加されていない
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
      // ウォレットがない場合は UI チェーンのみ切り替え
      set({ currentChainId: chainId })
    }
  },
}))
```

### チェーン切り替え Hook

```typescript
// hooks/useChainSwitch.ts
import { useEffect } from 'react'
import { useMultiChainStore } from '../store/multiChainStore'

export function useChainSwitch() {
  const { currentChainId, walletChainId, switchChain, fetchBalances, account } =
    useMultiChainStore()

  // ウォレットのチェーン切り替えを監視
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16)
      useMultiChainStore.getState().setWalletChain(newChainId)
      // ウォレットがチェーンを切り替えた場合、UI を同期
      useMultiChainStore.getState().setCurrentChain(newChainId)

      // 残高を再取得
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

## クロスチェーンデータ同期戦略

### 資産集約ビュー

ユーザーは複数のチェーンで資産を保有しており、フロントエンドは集約して表示する必要があります：

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

          // ネイティブ残高
          const nativeBalance = await provider.getBalance(account)

          // トークン残高（コントラクトが該当チェーンにデプロイされている場合）
          let tokenBalance = ethers.BigNumber.from(0)
          try {
            const { address, abi } = getContractConfig('Token', chainId)
            const contract = new ethers.Contract(address, abi, provider)
            tokenBalance = await contract.balanceOf(account)
          } catch {
            // コントラクトが該当チェーンにデプロイされていない可能性
          }

          return {
            chainId,
            chainName: CHAINS[chainId].name,
            nativeBalance: ethers.utils.formatEther(nativeBalance),
            tokenBalance: ethers.utils.formatEther(tokenBalance),
            totalUsd: 0, // 価格 API が必要
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

    // 30 秒ごとに更新
    const interval = setInterval(fetchAllChains, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [account, rpcManager])

  // 総残高の集約
  const totalNative = assets.reduce(
    (sum, a) => sum + parseFloat(a.nativeBalance),
    0
  )

  return { assets, totalNative, loading }
}
```

## クロスチェーンブリッジのフロントエンド統合

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
      alert('送信元チェーンと宛先チェーンを同じにすることはできません')
      return
    }

    // ウォレットが送信元チェーン上にあることを確認
    if (currentChainId !== fromChain) {
      await switchChain(fromChain)
    }

    // チェーンペアに基づいてブリッジを選択
    const bridge = selectBridge(fromChain, toChain)
    await bridge.transfer(amount, toChain)
  }

  return (
    <div className="bridge-container">
      <div className="chain-selector">
        <label>送信元</label>
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
        <label>宛先</label>
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
        placeholder="送金額"
      />

      <button onClick={handleBridge}>クロスチェーン送金</button>
    </div>
  )
}

function selectBridge(fromChain: number, toChain: number) {
  // チェーンペアに基づいて最適ブリッジを選択
  if (fromChain === 1 && (toChain === 10 || toChain === 42161)) {
    return new OfficialBridge(toChain) // 公式ブリッジ
  }
  return new ThirdPartyBridge(fromChain, toChain) // サードパーティブリッジ
}
```

## Chain ID 検出とネットワーク切り替え UX

```typescript
// components/NetworkGuard.tsx
import { useMultiChainStore } from '../store/multiChainStore'
import { CHAINS } from '../config/chains'

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { walletChainId, currentChainId, switchChain } = useMultiChainStore()

  // ウォレット未接続
  if (walletChainId === null) {
    return <>{children}</>
  }

  // ウォレットのチェーンと現在選択中のチェーンが不一致
  if (walletChainId !== currentChainId) {
    return (
      <div className="network-warning">
        <h3>ネットワーク不一致</h3>
        <p>
          現在のページには <strong>{CHAINS[currentChainId].name}</strong> が必要です、
          しかしウォレットは{' '}
          <strong>{CHAINS[walletChainId]?.name || '不明なチェーン'}</strong> に接続しています
        </p>
        <button onClick={() => switchChain(currentChainId)}>
          {CHAINS[currentChainId].name} に切り替え
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

### チェーンセレクターコンポーネント

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

## パフォーマンス考察：マルチチェーン RPC 並行リクエスト

マルチチェーン環境では、フロントエンドが複数のチェーンに同時に RPC リクエストを送信することが頻繁にあります。制御しないとパフォーマンスの問題を引き起こします。

```typescript
// lib/concurrentMultiChain.ts
import { SUPPORTED_CHAIN_IDS } from '../config/chains'

// 並行制限器
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

// マルチチェーン残高のバッチ照会（並行制御付き）
async function batchQueryBalances(
  account: string,
  rpcManager: RpcManager
) {
  const limiter = new ConcurrencyLimiter(3) // 最大 3 並行

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

### リクエストキャッシュとデデュプリケーション

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
    // キャッシュをチェック
    const cached = this.cache.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.value
    }

    // デデュプリケーション：同じリクエストが進行中の場合は再利用
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
    15000 // 15 秒キャッシュ
  )
}
```

## まとめ

マルチチェーン DApp アーキテクチャの核心は「設定駆動 + 統一抽象化」にあります。チェーン設定とコントラクトアドレスレジストリを一元管理することで、フロントエンドはハードコーディングなしに異なるチェーン間で柔軟に切り替えできます。RPC マネージャーはフェイルオーバーと並行制御を担当し、状態マネージャーはチェーン切り替えとクロスチェーンデータ集約を処理します。

クロスチェーンブリッジの統合はマルチチェーン DApp の重要コンポーネントです。フロントエンドはチェーンペアに基づいて最適ブリッジ（公式ブリッジ vs サードパーティブリッジ）を選択し、ブリッジの異なるインタラクションモード（即時着金 vs 遅延着金）を処理する必要があります。この部分のロジックの複雑さは侮れません。

パフォーマンス面では、マルチチェーン RPC 並行リクエストが主要なボトルネックです。並行制限器、リクエストキャッシュ、デデュプリケーションが3つの主要な最適化手段です。実際のプロジェクトでは `Promise.all` ではなく `Promise.allSettled` の使用を推奨し、単一チェーンのリクエスト失敗が他のチェーンのデータ取得に影響しないようにします。

チェーン数の継続的な増加（現在50以上の EVM 互換チェーンが存在する）に伴い、マルチチェーンアーキテクチャ設計はますます重要になります。フロントエンドフレームワークとツールチェーン（wagmi v2 のマルチチェーン Provider など）も急速に進化していますが、核心的なアーキテクチャ原則は不変です：設定化、抽象化、防御的プログラミング。
