---
title: "RainbowKit 錢包集成：DApp 連接體驗設計"
date: 2023-10-28 12:55:06
tags:
  - Web3
  - React
  - DApp
readingTime: 9
description: "錢包連接是 DApp 用戶體驗的第一道門檻。RainbowKit 基於 wagmi 構建，提供開箱即用的連接組件和優雅的 UX 設計。本文覆蓋從基礎集成到深度定製的完整方案。"
wordCount: 1175
---

錢包連接是每個 DApp 的入口體驗。在 Web3 生態中，用戶可能使用 MetaMask、WalletConnect、Coinbase Wallet、Rainbow、Phantom 等多種錢包。為每種錢包單獨實現連接邏輯既繁瑣又容易出錯。RainbowKit 由 Rainbow Wallet 團隊開源，基於 wagmi 和 viem 構建，提供了一套完整的、可定製的錢包連接解決方案。

## RainbowKit 概述

### wagmi + RainbowKit 的組合

RainbowKit 不是一個獨立的錢包連接庫，而是建立在 wagmi 之上的 UI 層：

```
┌───────────────────────────────┐
│         RainbowKit (UI)       │ ← 連接按鈕、模態框、錯誤提示
├───────────────────────────────┤
│          wagmi (Hooks)        │ ← 錢包連接邏輯、狀態管理
├───────────────────────────────┤
│          viem (Core)          │ ← 以太坊交互、類型安全
└───────────────────────────────┘
```

- **viem**：底層以太坊 TypeScript 庫，提供類型安全的 RPC 交互
- **wagmi**：React Hooks 庫，封裝 viem 提供響應式的鏈上數據
- **RainbowKit**：UI 組件庫，提供錢包連接的完整交互界面

### 為什麼選擇 RainbowKit

- 開箱即用的精美 UI，支持暗色/亮色主題
- 內置 20+ 種錢包的支持
- 自動處理 WalletConnect v2 協議
- 類型安全的合約交互（via viem）
- 活躍的社區和快速迭代

## 快速集成

### 安裝依賴

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### 基礎配置

```tsx
// app/providers.tsx
import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { configureChains, createConfig, WagmiConfig } from 'wagmi'
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
} from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 配置支持的鏈
const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum, base],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY! }),
    publicProvider(),
  ]
)

// 配置錢包
const { connectors } = getDefaultWallets({
  appName: 'My DApp',
  projectId: process.env.WALLETCONNECT_PROJECT_ID!,
  chains,
})

// 創建 wagmi config
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme({
            accentColor: '#7b3fe4',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
```

### 使用 ConnectButton

```tsx
// app/page.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Home() {
  return (
    <main>
      <header>
        <ConnectButton />
      </header>
      <div>
        <h1>My DApp</h1>
        {/* DApp 內容 */}
      </div>
    </main>
  )
}
```

`ConnectButton` 是 RainbowKit 的核心組件，它處理了所有連接邏輯：

- 未連接時顯示"Connect Wallet"按鈕
- 點擊後彈出錢包選擇模態框
- 連接後顯示地址、鏈信息、餘額
- 支持斷開連接、切換鏈

## 錢包列表配置

### 自定義 supportedWallets

```tsx
import {
  getDefaultWallets,
  wallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit'

const { connectors } = getDefaultWallets({
  appName: 'My DApp',
  projectId: process.env.WALLETCONNECT_PROJECT_ID!,
  chains,
})

// 或者完全自定義錢包列表
const customConnectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      wallets.metaMask({ chains, projectId: WC_PROJECT_ID }),
      wallets.rainbow({ chains, projectId: WC_PROJECT_ID }),
      wallets.coinbase({ appName: 'My DApp', chains }),
      wallets.walletConnect({ chains, projectId: WC_PROJECT_ID }),
    ],
  },
  {
    groupName: 'More',
    wallets: [
      wallets.trust({ chains, projectId: WC_PROJECT_ID }),
      wallets.ledger({ chains, projectId: WC_PROJECT_ID }),
      wallets.brave({ chains, projectId: WC_PROJECT_ID }),
      wallets.okxWallet({ chains, projectId: WC_PROJECT_ID }),
    ],
  },
])

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: customConnectors,
  publicClient,
})
```

### 添加自定義錢包

```tsx
import { createWallet } from '@rainbow-me/rainbowkit'

// 創建自定義錢包
const myCustomWallet = createWallet({
  id: 'my-wallet',
  name: 'My Wallet',
  iconUrl: 'https://my-wallet.com/icon.png',
  iconBackground: '#fff',
  downloadUrls: {
    browserExtension: 'https://my-wallet.com/download',
  },
  // 檢測擴展是否安裝
  installed: typeof window !== 'undefined' && !!window.myWallet,
  // 連接邏輯
  createConnector: () => {
    return {
      connector: new MyWalletConnector({
        chains,
        options: { /* wallet options */ },
      }),
    }
  },
})

const connectors = connectorsForWallets([
  {
    groupName: 'Popular',
    wallets: [
      wallets.metaMask({ chains, projectId: WC_PROJECT_ID }),
      myCustomWallet, // 自定義錢包
    ],
  },
])
```

## 連接 UX

### 模態框設計與引導流程

RainbowKit 的連接模態框分為幾個階段：

1. **錢包選擇**：展示可用錢包列表
2. **連接中**：顯示連接狀態和加載動畫
3. **已連接**：顯示賬戶信息

```tsx
// 自定義連接狀態展示
import { ConnectButton } from '@rainbow-me/rainbowkit'

function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none' },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="connect-button"
                  >
                    連接錢包
                  </button>
                )
              }

              return (
                <div className="wallet-info">
                  {/* 鏈切換按鈕 */}
                  <button
                    onClick={openChainModal}
                    className="chain-button"
                  >
                    {chain.hasIcon && (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name}
                        className="chain-icon"
                      />
                    )}
                    {chain.name}
                  </button>

                  {/* 賬戶按鈕 */}
                  <button
                    onClick={openAccountModal}
                    className="account-button"
                  >
                    {account.displayBalance && (
                      <span className="balance">
                        {account.displayBalance}
                      </span>
                    )}
                    <span className="address">
                      {account.displayName}
                    </span>
                  </button>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
```

## 網絡切換與錯誤處理

### 錯誤提示

RainbowKit 內置了網絡切換和錯誤處理的 UI：

```tsx
import {
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit'

<RainbowKitProvider
  chains={chains}
  theme={lightTheme()}
  // 初始鏈
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>
```

### 強制特定鏈

```tsx
import { RainbowKitProvider, RainbowKitAuthenticationProvider } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

// 方式 1：設置初始鏈
<RainbowKitProvider
  chains={chains}
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>

// 方式 2：在 Hook 中檢查鏈
import { useNetwork, useSwitchNetwork } from 'wagmi'

function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  const isCorrectChain = chain?.id === desiredChainId

  if (!isCorrectChain) {
    return (
      <div className="chain-warning">
        <p>請在 MetaMask 中切換到 {chainName}</p>
        <button onClick={() => switchNetwork?.(desiredChainId)}>
          切換網絡
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

## 主題定製

### 預設主題

```tsx
import { darkTheme, lightTheme, midnightTheme } from '@rainbow-me/rainbowkit'

// 暗色主題
<RainbowKitProvider theme={darkTheme()}>
  <App />
</RainbowKitProvider>

// 午夜主題（更深的暗色）
<RainbowKitProvider theme={midnightTheme()}>
  <App />
</RainbowKitProvider>

// 亮色主題
<RainbowKitProvider theme={lightTheme()}>
  <App />
</RainbowKitProvider>
```

### 自定義主題

```tsx
import { darkTheme } from '@rainbow-me/rainbowkit'

const customTheme = darkTheme({
  // 品牌色
  accentColor: '#7b3fe4',
  accentColorForeground: 'white',

  // 背景色
  overlayBlur: 'small',

  // 圓角
  borderRadius: 'medium',

  // 字體
  fontStack: 'system',

  // CSS 變量覆蓋
  connectButton: {
    background: '#7b3fe4',
    innerBackground: '#5a2db0',
  },
})

<RainbowKitProvider theme={customTheme}>
  <App />
</RainbowKitProvider>
```

### 響應式主題切換

```tsx
import { useTheme } from 'next-themes'
import { darkTheme, lightTheme } from '@rainbow-me/rainbowkit'

function AppWithTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  const rainbowTheme = resolvedTheme === 'dark'
    ? darkTheme({ accentColor: '#7b3fe4' })
    : lightTheme({ accentColor: '#7b3fe4' })

  return (
    <RainbowKitProvider theme={rainbowTheme}>
      {children}
    </RainbowKitProvider>
  )
}
```

## 完整的 RainbowKit 集成

```tsx
// app/layout.tsx
import '@rainbow-me/rainbowkit/styles.css'
import './globals.css'
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

// app/providers.tsx
'use client'
import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
  Locale,
} from '@rainbow-me/rainbowkit'
import { configureChains, createConfig, WagmiConfig } from 'wagmi'
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
} from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum, base],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY! }),
    publicProvider(),
  ]
)

const { connectors } = getDefaultWallets({
  appName: 'My DApp',
  projectId: process.env.WALLETCONNECT_PROJECT_ID!,
  chains,
})

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme({
            accentColor: '#7b3fe4',
            borderRadius: 'medium',
          })}
          locale={Locale.zh_CN}
          showRecentTransactions={true}
          appInfo={{
            appName: 'My DApp',
            learnMoreUrl: 'https://my-dapp.com/about',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}

// app/page.tsx
'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import { parseEther } from 'viem'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })

  return (
    <main className="container">
      <header className="header">
        <h1>My DApp</h1>
        <ConnectButton />
      </header>

      {isConnected && (
        <section className="dashboard">
          <h2>賬戶信息</h2>
          <p>地址: {address}</p>
          <p>餘額: {balance?.formatted} {balance?.symbol}</p>

          <ContractInteraction />
        </section>
      )}

      {!isConnected && (
        <section className="welcome">
          <h2>歡迎使用 My DApp</h2>
          <p>請連接錢包以開始</p>
        </section>
      )}
    </main>
  )
}

// 合約交互組件
function ContractInteraction() {
  const { address } = useAccount()

  // 使用 wagmi 的合約交互 Hook
  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })

  const { writeContract, isPending } = useWriteContract()

  const handleApprove = async () => {
    writeContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SPENDER_ADDRESS, parseEther('100')],
    })
  }

  return (
    <div>
      <h3>代幣操作</h3>
      <p>代幣餘額: {balance?.toString()}</p>
      <button onClick={handleApprove} disabled={isPending}>
        {isPending ? '授權中...' : '授權'}
      </button>
    </div>
  )
}
```

## 與自行實現錢包連接的對比

### 自行實現的複雜度

```tsx
// 不使用 RainbowKit 的自行實現 —— 僅 MetaMask
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function useMetaMask() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    // 檢查已連接
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0])
      })

    // 監聽賬戶變化
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // 監聽鏈變化
    window.ethereum.on('chainChanged', (chainId: string) => {
      setChainId(parseInt(chainId, 16))
    })

    // 監聽斷開
    window.ethereum.on('disconnect', () => {
      setAccount(null)
    })
  }, [])

  const connect = async () => {
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })
      setAccount(accounts[0])
    } catch (err: any) {
      if (err.code === 4001) {
        setError('用戶拒絕了連接請求')
      } else {
        setError(err.message)
      }
    }
  }

  const switchChain = async (chainId: number) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + chainId.toString(16) }],
      })
    } catch (err: any) {
      // 處理各種錯誤碼
      if (err.code === 4902) {
        // 鏈未添加
      } else if (err.code === 4001) {
        // 用戶拒絕
      }
    }
  }

  return { account, chainId, error, connect, switchChain }
}

// 還需要處理：
// - WalletConnect v2 協議
// - Coinbase Wallet SDK
// - 移動端深度鏈接
// - 錯誤恢復
// - 自動重連
// - 多錢包衝突檢測
// ... 以上每個都需要大量代碼
```

### 對比

| 維度 | RainbowKit | 自行實現 |
|------|-----------|---------|
| 開發時間 | ~30 分鐘 | 數天 |
| 錢包支持 | 20+ 種 | 僅已實現的 |
| WalletConnect v2 | 內置 | 需自行集成 |
| 移動端適配 | 內置 | 需自行處理 |
| 錯誤處理 | 完善的 UI | 需自行實現 |
| 主題定製 | 內置 | 需自行設計 |
| 維護成本 | 庫更新 | 持續維護 |
| 包體積 | ~50KB | 0（但代碼量大） |

## 移動端深度鏈接

移動端用戶沒有瀏覽器擴展，需要通過深度鏈接跳轉到錢包 App：

```tsx
import {
  RainbowKitProvider,
  DisclaimerComponent,
} from '@rainbow-me/rainbowkit'

// RainbowKit 自動處理移動端深度鏈接
// 當移動端用戶點擊連接時：
// 1. 檢測是否安裝了對應錢包 App
// 2. 如果安裝了，直接跳轉到 App
// 3. 如果沒安裝，跳轉到應用商店下載

// 自定義免責聲明
const Disclaimer: DisclaimerComponent = ({ Link, Text }) => (
  <Text>
    連接錢包即表示您同意我們的{' '}
    <Link href="https://my-dapp.com/terms">服務條款</Link>
    {' '}和{' '}
    <Link href="https://my-dapp.com/privacy">隱私政策</Link>
  </Text>
)

<RainbowKitProvider disclaimerComponent={Disclaimer}>
  <App />
</RainbowKitProvider>
```

### 移動端檢測與引導

```tsx
import { isMobile } from '@rainbow-me/rainbowkit'

function MobileWarning() {
  if (!isMobile()) return null

  return (
    <div className="mobile-banner">
      <p>
        推薦使用錢包 App 連接。
        點擊"連接錢包"後會自動跳轉。
      </p>
    </div>
  )
}
```

## 認證集成

RainbowKit 支持與後端認證系統集成：

```tsx
import {
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
} from '@rainbow-me/rainbowkit'
import { SiweMessage } from 'siwe'

const authenticationAdapter = createAuthenticationAdapter({
  getNonce: async () => {
    const response = await fetch('/api/nonce')
    return response.text()
  },

  createMessage: ({ nonce, address, chainId }) => {
    return new SiweMessage({
      domain: window.location.host,
      address,
      statement: 'Sign in with Ethereum to the app',
      uri: window.location.origin,
      version: '1',
      chainId,
      nonce,
    })
  },

  getMessageBody: ({ message }) => {
    return message.prepareMessage()
  },

  verify: async ({ message, signature }) => {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    })
    return response.ok
  },

  signOut: async () => {
    await fetch('/api/logout', { method: 'POST' })
  },
})

function AppWithAuth({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<
    'loading' | 'authenticated' | 'unauthenticated'
  >('loading')

  useEffect(() => {
    fetch('/api/me').then((res) => {
      setAuthStatus(res.ok ? 'authenticated' : 'unauthenticated')
    })
  }, [])

  return (
    <RainbowKitAuthenticationProvider
      adapter={authenticationAdapter}
      status={authStatus}
    >
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  )
}
```

## 個人觀點

經過多個項目的實踐，我認為錢包連接 UX 的最佳實踐有以下幾條：

**連接入口要顯眼但不過於強勢**。ConnectButton 應放在頁面的固定位置（通常是右上角），不要用全屏彈窗強制要求連接。用戶應該能先瀏覽 DApp 內容，再決定是否連接。對於必須連接才能使用的功能，在交互點附近顯示"連接錢包"提示即可。

**鏈切換是最容易被忽略的體驗斷點**。用戶經常在錯誤的鏈上操作，導致交易失敗或資金丟失。RainbowKit 的鏈切換按鈕需要足夠顯眼，並且在用戶嘗試操作不支持的鏈時主動提示切換。

**移動端體驗決定了用戶留存率**。桌面端用戶有瀏覽器擴展錢包，連接體驗相對順暢。但移動端用戶需要通過 WalletConnect 或深度鏈接跳轉到錢包 App，這個流程的流失率很高。RainbowKit 的移動端適配已經做得很好，但仍需要測試各種錢包 App 的實際兼容性。

**自動重連是必要功能**。用戶刷新頁面或重新打開標籤頁後不應該需要重新連接。`autoConnect: true` 配置確保了這一點，但需要注意安全提示——自動重連不應該觸發任何交易操作。

**Transaction 狀態展示是加分項**。RainbowKit 的 `showRecentTransactions` 功能讓用戶可以在錢包模態框中看到最近的交易記錄，這對交易追蹤很有幫助。但更復雜的交易狀態（如跨鏈交易、多步交易）仍需要 DApp 自行處理。

RainbowKit 的設計哲學是"約定優於配置"——它做出了合理默認選擇，讓開發者能快速上手，同時保留了足夠的定製空間。對於 95% 的 DApp 來說，RainbowKit 的默認配置已經足夠好，不需要深度定製。把精力放在 DApp 核心功能的用戶體驗上，而不是錢包連接的 UI 細節上。
