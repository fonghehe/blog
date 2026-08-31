---
title: "RainbowKit ウォレット統合：DApp 接続体験のデザイン"
date: 2023-10-28 12:55:06
tags:
  - Web3
  - React
  - DApp
readingTime: 12
description: "ウォレット接続は DApp ユーザー体験の最初のハードルです。RainbowKit は wagmi 上に構築され、すぐに使える接続コンポーネントとエレガントな UX デザインを提供します。本記事では基礎的な統合から深いカスタマイズまでの完全な方案を網羅します。"
wordCount: 1995
---

ウォレット接続はすべての DApp の入り口体験です。Web3 エコシステムにおいて、ユーザーは MetaMask、WalletConnect、Coinbase Wallet、Rainbow、Phantom など多様なウォレットを使用する可能性があります。各ウォレットに対して個別に接続ロジックを実装するのは煩雑でエラーが起きやすいです。RainbowKit は Rainbow Wallet チームがオープンソース化したもので、wagmi と viem 上に構築され、完全でカスタマイズ可能なウォレット接続ソリューションを提供します。

## RainbowKit の概要

### wagmi + RainbowKit の組み合わせ

RainbowKit は独立したウォレット接続ライブラリではなく、wagmi の上に構築された UI レイヤーです：

```
┌───────────────────────────────┐
│         RainbowKit (UI)       │ ← 接続ボタン、モーダル、エラー表示
├───────────────────────────────┤
│          wagmi (Hooks)        │ ← ウォレット接続ロジック、状態管理
├───────────────────────────────┤
│          viem (Core)          │ ← Ethereum インタラクション、型安全性
└───────────────────────────────┘
```

- **viem**：基盤の Ethereum TypeScript ライブラリ、型安全な RPC インタラクションを提供
- **wagmi**：React Hooks ライブラリ、viem をカプセル化してリアクティブなオンチェーンデータを提供
- **RainbowKit**：UI コンポーネントライブラリ、ウォレット接続の完全なインタラクション画面を提供

### RainbowKit を選ぶ理由

- すぐに使える洗練された UI、ダーク/ライトテーマをサポート
- 20+ 種類のウォレットの組み込みサポート
- WalletConnect v2 プロトコルの自動処理
- 型安全なコントラクトインタラクション（viem 経由）
- 活発なコミュニティと迅速なイテレーション

## クイック統合

### 依存関係のインストール

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### 基本設定

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

// サポートするチェーンを設定
const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum, base],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY! }),
    publicProvider(),
  ]
)

// ウォレットを設定
const { connectors } = getDefaultWallets({
  appName: 'My DApp',
  projectId: process.env.WALLETCONNECT_PROJECT_ID!,
  chains,
})

// wagmi config を作成
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

### ConnectButton の使用

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
        {/* DApp コンテンツ */}
      </div>
    </main>
  )
}
```

`ConnectButton` は RainbowKit のコアコンポーネントで、すべての接続ロジックを処理します：

- 未接続時に「Connect Wallet」ボタンを表示
- クリック後にウォレット選択モーダルをポップアップ
- 接続後にアドレス、チェーン情報、残高を表示
- 切断、チェーン切り替えをサポート

## ウォレットリストの設定

### supportedWallets のカスタマイズ

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

// または完全にカスタムウォレットリスト
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

### カスタムウォレットの追加

```tsx
import { createWallet } from '@rainbow-me/rainbowkit'

// カスタムウォレットの作成
const myCustomWallet = createWallet({
  id: 'my-wallet',
  name: 'My Wallet',
  iconUrl: 'https://my-wallet.com/icon.png',
  iconBackground: '#fff',
  downloadUrls: {
    browserExtension: 'https://my-wallet.com/download',
  },
  // 拡張機能がインストールされているか検出
  installed: typeof window !== 'undefined' && !!window.myWallet,
  // 接続ロジック
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
      myCustomWallet, // カスタムウォレット
    ],
  },
])
```

## 接続 UX

### モーダルデザインとガイドフロー

RainbowKit の接続モーダルはいくつかの段階に分かれています：

1. **ウォレット選択**：利用可能なウォレットリストを表示
2. **接続中**：接続状態とローディングアニメーションを表示
3. **接続済み**：アカウント情報を表示

```tsx
// カスタム接続状態表示
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
                    ウォレット接続
                  </button>
                )
              }

              return (
                <div className="wallet-info">
                  {/* チェーン切り替えボタン */}
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

                  {/* アカウントボタン */}
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

## ネットワーク切り替えとエラー処理

### エラー表示

RainbowKit はネットワーク切り替えとエラー処理の UI を組み込みで提供しています：

```tsx
import {
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit'

<RainbowKitProvider
  chains={chains}
  theme={lightTheme()}
  // 初期チェーン
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>
```

### 特定チェーンの強制

```tsx
import { RainbowKitProvider, RainbowKitAuthenticationProvider } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

// 方式 1：初期チェーンを設定
<RainbowKitProvider
  chains={chains}
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>

// 方式 2：Hook でチェーンをチェック
import { useNetwork, useSwitchNetwork } from 'wagmi'

function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  const isCorrectChain = chain?.id === desiredChainId

  if (!isCorrectChain) {
    return (
      <div className="chain-warning">
        <p>MetaMask で {chainName} に切り替えてください</p>
        <button onClick={() => switchNetwork?.(desiredChainId)}>
          ネットワーク切り替え
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

## テーマのカスタマイズ

### プリセットテーマ

```tsx
import { darkTheme, lightTheme, midnightTheme } from '@rainbow-me/rainbowkit'

// ダークテーマ
<RainbowKitProvider theme={darkTheme()}>
  <App />
</RainbowKitProvider>

// ミッドナイトテーマ（より深いダーク）
<RainbowKitProvider theme={midnightTheme()}>
  <App />
</RainbowKitProvider>

// ライトテーマ
<RainbowKitProvider theme={lightTheme()}>
  <App />
</RainbowKitProvider>
```

### カスタムテーマ

```tsx
import { darkTheme } from '@rainbow-me/rainbowkit'

const customTheme = darkTheme({
  // ブランドカラー
  accentColor: '#7b3fe4',
  accentColorForeground: 'white',

  // 背景色
  overlayBlur: 'small',

  // 角丸
  borderRadius: 'medium',

  // フォント
  fontStack: 'system',

  // CSS 変数のオーバーライド
  connectButton: {
    background: '#7b3fe4',
    innerBackground: '#5a2db0',
  },
})

<RainbowKitProvider theme={customTheme}>
  <App />
</RainbowKitProvider>
```

### レスポンシブテーマ切り替え

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

## 完全な RainbowKit 統合

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
    <html lang="ja">
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
          locale={Locale.ja_JP}
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
          <h2>アカウント情報</h2>
          <p>アドレス: {address}</p>
          <p>残高: {balance?.formatted} {balance?.symbol}</p>

          <ContractInteraction />
        </section>
      )}

      {!isConnected && (
        <section className="welcome">
          <h2>My DApp へようこそ</h2>
          <p>ウォレットを接続して開始してください</p>
        </section>
      )}
    </main>
  )
}

// コントラクトインタラクションコンポーネント
function ContractInteraction() {
  const { address } = useAccount()

  // wagmi のコントラクトインタラクション Hook を使用
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
      <h3>トークン操作</h3>
      <p>トークン残高: {balance?.toString()}</p>
      <button onClick={handleApprove} disabled={isPending}>
        {isPending ? '承認中...' : '承認'}
      </button>
    </div>
  )
}
```

## ウォレット接続の自前実装との比較

### 自前実装の複雑さ

```tsx
// RainbowKit を使用しない自前実装 —— MetaMask のみ
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function useMetaMask() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    // 接続済みかチェック
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0])
      })

    // アカウント変化の監視
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // チェーン変化の監視
    window.ethereum.on('chainChanged', (chainId: string) => {
      setChainId(parseInt(chainId, 16))
    })

    // 切断の監視
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
        setError('ユーザーが接続要求を拒否しました')
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
      // 各種エラーコードの処理
      if (err.code === 4902) {
        // チェーンが追加されていない
      } else if (err.code === 4001) {
        // ユーザーが拒否
      }
    }
  }

  return { account, chainId, error, connect, switchChain }
}

// さらに以下も処理する必要がある：
// - WalletConnect v2 プロトコル
// - Coinbase Wallet SDK
// - モバイルのディープリンク
// - エラーリカバリー
// - 自動再接続
// - 複数ウォレットの競合検出
// ... 上記それぞれに大量のコードが必要
```

### 比較

| 次元 | RainbowKit | 自前実装 |
|------|-----------|---------|
| 開発時間 | ~30 分 | 数日 |
| ウォレットサポート | 20+ 種類 | 実装済みのもののみ |
| WalletConnect v2 | 組み込み | 自前で統合が必要 |
| モバイル対応 | 組み込み | 自前で処理が必要 |
| エラー処理 | 完璧な UI | 自前で実装が必要 |
| テーマカスタマイズ | 組み込み | 自前でデザインが必要 |
| 保守コスト | ライブラリ更新 | 継続的な保守 |
| パッケージサイズ | ~50KB | 0（ただしコード量大） |

## モバイルディープリンク

モバイルユーザーはブラウザ拡張機能を持たないため、ディープリンクでウォレット App にジャンプする必要があります：

```tsx
import {
  RainbowKitProvider,
  DisclaimerComponent,
} from '@rainbow-me/rainbowkit'

// RainbowKit はモバイルのディープリンクを自動処理
// モバイルユーザーが接続をクリックした場合：
// 1. 対応するウォレット App がインストールされているか検出
// 2. インストールされている場合、直接 App にジャンプ
// 3. インストールされていない場合、アプリストアにジャンプしてダウンロード

// カスタム免責事項
const Disclaimer: DisclaimerComponent = ({ Link, Text }) => (
  <Text>
    ウォレットを接続することで、当社の{' '}
    <Link href="https://my-dapp.com/terms">利用規約</Link>
    {' '}および{' '}
    <Link href="https://my-dapp.com/privacy">プライバシーポリシー</Link>
    に同意したことになります
  </Text>
)

<RainbowKitProvider disclaimerComponent={Disclaimer}>
  <App />
</RainbowKitProvider>
```

### モバイル検出とガイド

```tsx
import { isMobile } from '@rainbow-me/rainbowkit'

function MobileWarning() {
  if (!isMobile()) return null

  return (
    <div className="mobile-banner">
      <p>
        ウォレット App での接続を推奨します。
        「ウォレット接続」をクリックすると自動的にジャンプします。
      </p>
    </div>
  )
}
```

## 認証統合

RainbowKit はバックエンド認証システムとの統合をサポートしています：

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

## 個人的な見解

複数のプロジェクトでの実践を経て、ウォレット接続 UX のベストプラクティスは以下の通りだと考えています：

**接続入口は目立つが強制しすぎない**。ConnectButton はページの固定位置（通常は右上）に配置し、全画面ポップアップで接続を強制してはいけません。ユーザーはまず DApp のコンテンツを閲覧してから、接続するかどうかを決めるべきです。接続必須の機能については、インタラクションポイントの近くに「ウォレット接続」のヒントを表示すれば十分です。

**チェーン切り替えは最も見落とされやすい体験の分断点**です。ユーザーは誤ったチェーンで操作を行い、トランザクションの失敗や資金の紛失を招くことがよくあります。RainbowKit のチェーン切り替えボタンは十分に目立つ必要があり、ユーザーがサポート外のチェーンで操作を試みた際には積極的に切り替えを促す必要があります。

**モバイル体験がユーザー定着率を決定します**。デスクトップユーザーはブラウザ拡張ウォレットを持ち、接続体験は比較的スムーズです。しかしモバイルユーザーは WalletConnect やディープリンクでウォレット App にジャンプする必要があり、このフローでの離脱率は高いです。RainbowKit のモバイル対応はすでに良くできていますが、各種ウォレット App の実際の互換性をテストする必要があります。

**自動再接続は必須機能**です。ユーザーがページをリロードしたりタブを再開したりした際に、再接続を要求されるべきではありません。`autoConnect: true` の設定がこれを保証しますが、セキュリティの注意が必要です——自動再接続はいかなるトランザクション操作もトリガーすべきではありません。

**トランザクション状態の表示はプラス要素**です。RainbowKit の `showRecentTransactions` 機能により、ユーザーはウォレットモーダルで最近のトランザクション履歴を確認でき、トランザクションの追跡に役立ちます。ただしより複雑なトランザクション状態（クロスチェーン取引、マルチステップ取引など）は DApp 側で別途処理する必要があります。

RainbowKit のデザイン哲学は「設定より規約」です——合理的なデフォルト選択を行い、開発者が迅速に開始できるようにしつつ、十分なカスタマイズの余地を残しています。95% の DApp にとって、RainbowKit のデフォルト設定はすでに十分であり、深いカスタマイズは不要です。ウォレット接続の UI ディテールではなく、DApp コア機能のユーザー体験に注力すべきです。
