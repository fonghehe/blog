---
title: "RainbowKit Wallet Integration: DApp Connection Experience Design"
date: 2023-10-28 12:55:06
tags:
  - Web3
  - React
  - DApp
readingTime: 9
description: "Wallet connection is the first hurdle of DApp user experience. RainbowKit is built on wagmi, providing out-of-the-box connection components and elegant UX design. This article covers the complete solution from basic integration to deep customization."
wordCount: 692
---

Wallet connection is the entry experience for every DApp. In the Web3 ecosystem, users might use MetaMask, WalletConnect, Coinbase Wallet, Rainbow, Phantom, and various other wallets. Implementing connection logic separately for each wallet is both tedious and error-prone. RainbowKit, open-sourced by the Rainbow Wallet team and built on wagmi and viem, provides a complete, customizable wallet connection solution.

## RainbowKit Overview

### The wagmi + RainbowKit Combination

RainbowKit is not a standalone wallet connection library, but a UI layer built on top of wagmi:

```
┌───────────────────────────────┐
│         RainbowKit (UI)       │ ← Connect button, modal, error prompts
├───────────────────────────────┤
│          wagmi (Hooks)        │ ← Wallet connection logic, state management
├───────────────────────────────┤
│          viem (Core)          │ ← Ethereum interaction, type safety
└───────────────────────────────┘
```

- **viem**: The underlying Ethereum TypeScript library, providing type-safe RPC interactions
- **wagmi**: React Hooks library, wrapping viem to provide reactive on-chain data
- **RainbowKit**: UI component library, providing the complete interaction interface for wallet connection

### Why Choose RainbowKit

- Out-of-the-box beautiful UI, supports dark/light themes
- Built-in support for 20+ wallets
- Automatic WalletConnect v2 protocol handling
- Type-safe contract interactions (via viem)
- Active community and rapid iteration

## Quick Integration

### Installing Dependencies

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### Basic Configuration

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

// Configure supported chains
const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum, base],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY! }),
    publicProvider(),
  ]
)

// Configure wallets
const { connectors } = getDefaultWallets({
  appName: 'My DApp',
  projectId: process.env.WALLETCONNECT_PROJECT_ID!,
  chains,
})

// Create wagmi config
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

### Using ConnectButton

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
        {/* DApp content */}
      </div>
    </main>
  )
}
```

`ConnectButton` is RainbowKit's core component, handling all connection logic:

- Shows a "Connect Wallet" button when not connected
- Opens a wallet selection modal on click
- Displays address, chain info, and balance after connection
- Supports disconnecting and chain switching

## Wallet List Configuration

### Customizing supportedWallets

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

// Or fully customize the wallet list
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

### Adding a Custom Wallet

```tsx
import { createWallet } from '@rainbow-me/rainbowkit'

// Create a custom wallet
const myCustomWallet = createWallet({
  id: 'my-wallet',
  name: 'My Wallet',
  iconUrl: 'https://my-wallet.com/icon.png',
  iconBackground: '#fff',
  downloadUrls: {
    browserExtension: 'https://my-wallet.com/download',
  },
  // Detect if the extension is installed
  installed: typeof window !== 'undefined' && !!window.myWallet,
  // Connection logic
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
      myCustomWallet, // Custom wallet
    ],
  },
])
```

## Connection UX

### Modal Design and Onboarding Flow

RainbowKit's connection modal is divided into several stages:

1. **Wallet selection**: Displays the list of available wallets
2. **Connecting**: Shows connection status and loading animation
3. **Connected**: Displays account information

```tsx
// Custom connection status display
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
                    Connect Wallet
                  </button>
                )
              }

              return (
                <div className="wallet-info">
                  {/* Chain switch button */}
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

                  {/* Account button */}
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

## Network Switching and Error Handling

### Error Prompts

RainbowKit has built-in UI for network switching and error handling:

```tsx
import {
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit'

<RainbowKitProvider
  chains={chains}
  theme={lightTheme()}
  // Initial chain
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>
```

### Enforcing a Specific Chain

```tsx
import { RainbowKitProvider, RainbowKitAuthenticationProvider } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

// Method 1: Set initial chain
<RainbowKitProvider
  chains={chains}
  initialChain={mainnet}
>
  <App />
</RainbowKitProvider>

// Method 2: Check chain in a Hook
import { useNetwork, useSwitchNetwork } from 'wagmi'

function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  const isCorrectChain = chain?.id === desiredChainId

  if (!isCorrectChain) {
    return (
      <div className="chain-warning">
        <p>Please switch to {chainName} in MetaMask</p>
        <button onClick={() => switchNetwork?.(desiredChainId)}>
          Switch Network
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

## Theme Customization

### Preset Themes

```tsx
import { darkTheme, lightTheme, midnightTheme } from '@rainbow-me/rainbowkit'

// Dark theme
<RainbowKitProvider theme={darkTheme()}>
  <App />
</RainbowKitProvider>

// Midnight theme (deeper dark)
<RainbowKitProvider theme={midnightTheme()}>
  <App />
</RainbowKitProvider>

// Light theme
<RainbowKitProvider theme={lightTheme()}>
  <App />
</RainbowKitProvider>
```

### Custom Theme

```tsx
import { darkTheme } from '@rainbow-me/rainbowkit'

const customTheme = darkTheme({
  // Brand color
  accentColor: '#7b3fe4',
  accentColorForeground: 'white',

  // Background
  overlayBlur: 'small',

  // Border radius
  borderRadius: 'medium',

  // Font
  fontStack: 'system',

  // CSS variable overrides
  connectButton: {
    background: '#7b3fe4',
    innerBackground: '#5a2db0',
  },
})

<RainbowKitProvider theme={customTheme}>
  <App />
</RainbowKitProvider>
```

### Responsive Theme Switching

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

## Complete RainbowKit Integration

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
    <html lang="en">
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
          locale={Locale.en}
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
          <h2>Account Info</h2>
          <p>Address: {address}</p>
          <p>Balance: {balance?.formatted} {balance?.symbol}</p>

          <ContractInteraction />
        </section>
      )}

      {!isConnected && (
        <section className="welcome">
          <h2>Welcome to My DApp</h2>
          <p>Please connect your wallet to get started</p>
        </section>
      )}
    </main>
  )
}

// Contract interaction component
function ContractInteraction() {
  const { address } = useAccount()

  // Use wagmi's contract interaction Hook
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
      <h3>Token Operations</h3>
      <p>Token balance: {balance?.toString()}</p>
      <button onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving...' : 'Approve'}
      </button>
    </div>
  )
}
```

## Comparison with Self-Implemented Wallet Connection

### Complexity of Self-Implementation

```tsx
// Self-implementation without RainbowKit — MetaMask only
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function useMetaMask() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    // Check if already connected
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0])
      })

    // Listen for account changes
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // Listen for chain changes
    window.ethereum.on('chainChanged', (chainId: string) => {
      setChainId(parseInt(chainId, 16))
    })

    // Listen for disconnection
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
        setError('User rejected the connection request')
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
      // Handle various error codes
      if (err.code === 4902) {
        // Chain not added
      } else if (err.code === 4001) {
        // User rejected
      }
    }
  }

  return { account, chainId, error, connect, switchChain }
}

// Still need to handle:
// - WalletConnect v2 protocol
// - Coinbase Wallet SDK
// - Mobile deep linking
// - Error recovery
// - Auto-reconnect
// - Multi-wallet conflict detection
// ... each of the above requires significant code
```

### Comparison

| Dimension | RainbowKit | Self-Implementation |
|------|-----------|---------|
| Development time | ~30 minutes | Several days |
| Wallet support | 20+ types | Only what's implemented |
| WalletConnect v2 | Built-in | Need to integrate yourself |
| Mobile adaptation | Built-in | Need to handle yourself |
| Error handling | Comprehensive UI | Need to implement yourself |
| Theme customization | Built-in | Need to design yourself |
| Maintenance cost | Library updates | Ongoing maintenance |
| Bundle size | ~50KB | 0 (but large code volume) |

## Mobile Deep Linking

Mobile users don't have browser extensions and need to jump to wallet apps via deep links:

```tsx
import {
  RainbowKitProvider,
  DisclaimerComponent,
} from '@rainbow-me/rainbowkit'

// RainbowKit automatically handles mobile deep linking
// When a mobile user clicks connect:
// 1. Detect if the corresponding wallet app is installed
// 2. If installed, jump directly to the app
// 3. If not installed, redirect to the app store for download

// Custom disclaimer
const Disclaimer: DisclaimerComponent = ({ Link, Text }) => (
  <Text>
    By connecting your wallet, you agree to our{' '}
    <Link href="https://my-dapp.com/terms">Terms of Service</Link>
    {' '}and{' '}
    <Link href="https://my-dapp.com/privacy">Privacy Policy</Link>
  </Text>
)

<RainbowKitProvider disclaimerComponent={Disclaimer}>
  <App />
</RainbowKitProvider>
```

### Mobile Detection and Guidance

```tsx
import { isMobile } from '@rainbow-me/rainbowkit'

function MobileWarning() {
  if (!isMobile()) return null

  return (
    <div className="mobile-banner">
      <p>
        We recommend connecting with a wallet app.
        You'll be automatically redirected when you click "Connect Wallet."
      </p>
    </div>
  )
}
```

## Authentication Integration

RainbowKit supports integration with backend authentication systems:

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

## Personal Thoughts

After practicing across multiple projects, I believe the best practices for wallet connection UX include the following:

**The connection entry point should be prominent but not overly aggressive.** The ConnectButton should be placed in a fixed position on the page (usually the top right), without using full-screen popups to force connection. Users should be able to browse DApp content first, then decide whether to connect. For features that require connection, simply show a "Connect Wallet" prompt near the interaction point.

**Chain switching is the most easily overlooked experience breakpoint.** Users frequently operate on the wrong chain, leading to transaction failures or lost funds. RainbowKit's chain switch button needs to be sufficiently prominent, and when users attempt to operate on an unsupported chain, it should proactively prompt them to switch.

**Mobile experience determines user retention.** Desktop users have browser extension wallets, making the connection experience relatively smooth. But mobile users need to go through WalletConnect or deep links to jump to wallet apps, and this flow has a high drop-off rate. RainbowKit's mobile adaptation is already quite good, but still needs testing with various wallet apps for actual compatibility.

**Auto-reconnect is a necessary feature.** Users shouldn't need to reconnect after refreshing the page or reopening a tab. The `autoConnect: true` configuration ensures this, but security considerations are needed—auto-reconnect shouldn't trigger any transaction operations.

**Transaction status display is a bonus.** RainbowKit's `showRecentTransactions` feature lets users see recent transaction records in the wallet modal, which is helpful for transaction tracking. But more complex transaction states (such as cross-chain transactions, multi-step transactions) still need to be handled by the DApp itself.

RainbowKit's design philosophy is "convention over configuration"—it makes reasonable default choices, allowing developers to get started quickly while retaining enough customization space. For 95% of DApps, RainbowKit's default configuration is good enough without deep customization. Spend your energy on the user experience of the DApp's core features, not on the UI details of wallet connection.
