---
title: "RainbowKit 钱包集成：DApp 连接体验设计"
date: 2023-10-28 12:55:06
tags:
  - Web3
  - React
  - DApp
readingTime: 9
description: "钱包连接是 DApp 用户体验的第一道门槛。RainbowKit 基于 wagmi 构建，提供开箱即用的连接组件和优雅的 UX 设计。本文覆盖从基础集成到深度定制的完整方案。"
wordCount: 1178
---

钱包连接是每个 DApp 的入口体验。在当前的 Web3 生态中，用户可能使用 MetaMask、WalletConnect、Coinbase Wallet、Rainbow、Phantom 等多种钱包。为每种钱包单独实现连接逻辑既繁琐又容易出错。RainbowKit 由 Rainbow Wallet 团队开源，基于 wagmi 和 viem 构建，提供了一套完整的、可定制的钱包连接解决方案。

## RainbowKit 概述

### wagmi + RainbowKit 的组合

RainbowKit 不是一个独立的钱包连接库，而是建立在 wagmi 之上的 UI 层：

```
┌───────────────────────────────┐
│         RainbowKit (UI)       │ ← 连接按钮、模态框、错误提示
├───────────────────────────────┤
│          wagmi (Hooks)        │ ← 钱包连接逻辑、状态管理
├───────────────────────────────┤
│          viem (Core)          │ ← 以太坊交互、类型安全
└───────────────────────────────┘
```

- **viem**：底层以太坊 TypeScript 库，提供类型安全的 RPC 交互
- **wagmi**：React Hooks 库，封装 viem 提供响应式的链上数据
- **RainbowKit**：UI 组件库，提供钱包连接的完整交互界面

### 为什么选择 RainbowKit

- 开箱即用的精美 UI，支持暗色/亮色主题
- 内置 20+ 种钱包的支持
- 自动处理 WalletConnect v2 协议
- 类型安全的合约交互（via viem）
- 活跃的社区和快速迭代

## 快速集成

### 安装依赖

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### 基础配置

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

// 配置支持的链
const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum, base],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY! }),
    publicProvider(),
  ]
)

// 配置钱包
const { connectors } = getDefaultWallets({
  appName: 'My DApp',
  projectId: process.env.WALLETCONNECT_PROJECT_ID!,
  chains,
})

// 创建 wagmi config
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
        {/* DApp 内容 */}
      </div>
    </main>
  )
}
```

`ConnectButton` 是 RainbowKit 的核心组件，它处理了所有连接逻辑：

- 未连接时显示"Connect Wallet"按钮
- 点击后弹出钱包选择模态框
- 连接后显示地址、链信息、余额
- 支持断开连接、切换链

## 钱包列表配置

### 自定义 supportedWallets

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

// 或者完全自定义钱包列表
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

### 添加自定义钱包

```tsx
import { createWallet } from '@rainbow-me/rainbowkit'

// 创建自定义钱包
const myCustomWallet = createWallet({
  id: 'my-wallet',
  name: 'My Wallet',
  iconUrl: 'https://my-wallet.com/icon.png',
  iconBackground: '#fff',
  downloadUrls: {
    browserExtension: 'https://my-wallet.com/download',
  },
  // 检测扩展是否安装
  installed: typeof window !== 'undefined' && !!window.myWallet,
  // 连接逻辑
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
      myCustomWallet, // 自定义钱包
    ],
  },
])
```

## 连接 UX

### 模态框设计与引导流程

RainbowKit 的连接模态框分为几个阶段：

1. **钱包选择**：展示可用钱包列表
2. **连接中**：显示连接状态和加载动画
3. **已连接**：显示账户信息

```tsx
// 自定义连接状态展示
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
                    连接钱包
                  </button>
                )
              }

              return (
                <div className="wallet-info">
                  {/* 链切换按钮 */}
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

                  {/* 账户按钮 */}
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

## 网络切换与错误处理

### 错误提示

RainbowKit 内置了网络切换和错误处理的 UI：

```tsx
import {
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit'

<RainbowKitProvider
  chains={chains}
  theme={lightTheme()}
  // 初始链
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>
```

### 强制特定链

```tsx
import { RainbowKitProvider, RainbowKitAuthenticationProvider } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

// 方式 1：设置初始链
<RainbowKitProvider
  chains={chains}
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>

// 方式 2：在 Hook 中检查链
import { useNetwork, useSwitchNetwork } from 'wagmi'

function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  const isCorrectChain = chain?.id === desiredChainId

  if (!isCorrectChain) {
    return (
      <div className="chain-warning">
        <p>请在 MetaMask 中切换到 {chainName}</p>
        <button onClick={() => switchNetwork?.(desiredChainId)}>
          切换网络
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

## 主题定制

### 预设主题

```tsx
import { darkTheme, lightTheme, midnightTheme } from '@rainbow-me/rainbowkit'

// 暗色主题
<RainbowKitProvider theme={darkTheme()}>
  <App />
</RainbowKitProvider>

// 午夜主题（更深的暗色）
<RainbowKitProvider theme={midnightTheme()}>
  <App />
</RainbowKitProvider>

// 亮色主题
<RainbowKitProvider theme={lightTheme()}>
  <App />
</RainbowKitProvider>
```

### 自定义主题

```tsx
import { darkTheme } from '@rainbow-me/rainbowkit'

const customTheme = darkTheme({
  // 品牌色
  accentColor: '#7b3fe4',
  accentColorForeground: 'white',

  // 背景色
  overlayBlur: 'small',

  // 圆角
  borderRadius: 'medium',

  // 字体
  fontStack: 'system',

  // CSS 变量覆盖
  connectButton: {
    background: '#7b3fe4',
    innerBackground: '#5a2db0',
  },
})

<RainbowKitProvider theme={customTheme}>
  <App />
</RainbowKitProvider>
```

### 响应式主题切换

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
          <h2>账户信息</h2>
          <p>地址: {address}</p>
          <p>余额: {balance?.formatted} {balance?.symbol}</p>

          <ContractInteraction />
        </section>
      )}

      {!isConnected && (
        <section className="welcome">
          <h2>欢迎使用 My DApp</h2>
          <p>请连接钱包以开始</p>
        </section>
      )}
    </main>
  )
}

// 合约交互组件
function ContractInteraction() {
  const { address } = useAccount()

  // 使用 wagmi 的合约交互 Hook
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
      <h3>代币操作</h3>
      <p>代币余额: {balance?.toString()}</p>
      <button onClick={handleApprove} disabled={isPending}>
        {isPending ? '授权中...' : '授权'}
      </button>
    </div>
  )
}
```

## 与自行实现钱包连接的对比

### 自行实现的复杂度

```tsx
// 不使用 RainbowKit 的自行实现 —— 仅 MetaMask
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function useMetaMask() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    // 检查已连接
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0])
      })

    // 监听账户变化
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // 监听链变化
    window.ethereum.on('chainChanged', (chainId: string) => {
      setChainId(parseInt(chainId, 16))
    })

    // 监听断开
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
        setError('用户拒绝了连接请求')
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
      // 处理各种错误码
      if (err.code === 4902) {
        // 链未添加
      } else if (err.code === 4001) {
        // 用户拒绝
      }
    }
  }

  return { account, chainId, error, connect, switchChain }
}

// 还需要处理：
// - WalletConnect v2 协议
// - Coinbase Wallet SDK
// - 移动端深度链接
// - 错误恢复
// - 自动重连
// - 多钱包冲突检测
// ... 以上每个都需要大量代码
```

### 对比

| 维度 | RainbowKit | 自行实现 |
|------|-----------|---------|
| 开发时间 | ~30 分钟 | 数天 |
| 钱包支持 | 20+ 种 | 仅已实现的 |
| WalletConnect v2 | 内置 | 需自行集成 |
| 移动端适配 | 内置 | 需自行处理 |
| 错误处理 | 完善的 UI | 需自行实现 |
| 主题定制 | 内置 | 需自行设计 |
| 维护成本 | 库更新 | 持续维护 |
| 包体积 | ~50KB | 0（但代码量大） |

## 移动端深度链接

移动端用户没有浏览器扩展，需要通过深度链接跳转到钱包 App：

```tsx
import {
  RainbowKitProvider,
  DisclaimerComponent,
} from '@rainbow-me/rainbowkit'

// RainbowKit 自动处理移动端深度链接
// 当移动端用户点击连接时：
// 1. 检测是否安装了对应钱包 App
// 2. 如果安装了，直接跳转到 App
// 3. 如果没安装，跳转到应用商店下载

// 自定义免责声明
const Disclaimer: DisclaimerComponent = ({ Link, Text }) => (
  <Text>
    连接钱包即表示您同意我们的{' '}
    <Link href="https://my-dapp.com/terms">服务条款</Link>
    {' '}和{' '}
    <Link href="https://my-dapp.com/privacy">隐私政策</Link>
  </Text>
)

<RainbowKitProvider disclaimerComponent={Disclaimer}>
  <App />
</RainbowKitProvider>
```

### 移动端检测与引导

```tsx
import { isMobile } from '@rainbow-me/rainbowkit'

function MobileWarning() {
  if (!isMobile()) return null

  return (
    <div className="mobile-banner">
      <p>
        推荐使用钱包 App 连接。
        点击"连接钱包"后会自动跳转。
      </p>
    </div>
  )
}
```

## 认证集成

RainbowKit 支持与后端认证系统集成：

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

## 个人观点

经过多个项目的实践，我认为钱包连接 UX 的最佳实践有以下几条：

**连接入口要显眼但不过于强势**。ConnectButton 应放在页面的固定位置（通常是右上角），不要用全屏弹窗强制要求连接。用户应该能先浏览 DApp 内容，再决定是否连接。对于必须连接才能使用的功能，在交互点附近显示"连接钱包"提示即可。

**链切换是最容易被忽略的体验断点**。用户经常在错误的链上操作，导致交易失败或资金丢失。RainbowKit 的链切换按钮需要足够显眼，并且在用户尝试操作不支持的链时主动提示切换。

**移动端体验决定了用户留存率**。桌面端用户有浏览器扩展钱包，连接体验相对顺畅。但移动端用户需要通过 WalletConnect 或深度链接跳转到钱包 App，这个流程的流失率很高。RainbowKit 的移动端适配已经做得很好，但仍需要测试各种钱包 App 的实际兼容性。

**自动重连是必要功能**。用户刷新页面或重新打开标签页后不应该需要重新连接。`autoConnect: true` 配置确保了这一点，但需要注意安全提示——自动重连不应该触发任何交易操作。

**Transaction 状态展示是加分项**。RainbowKit 的 `showRecentTransactions` 功能让用户可以在钱包模态框中看到最近的交易记录，这对交易追踪很有帮助。但更复杂的交易状态（如跨链交易、多步交易）仍需要 DApp 自行处理。

RainbowKit 的设计哲学是"约定优于配置"——它做出了合理默认选择，让开发者能快速上手，同时保留了足够的定制空间。对于 95% 的 DApp 来说，RainbowKit 的默认配置已经足够好，不需要深度定制。把精力放在 DApp 核心功能的用户体验上，而不是钱包连接的 UI 细节上。
