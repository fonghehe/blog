---
title: "DApp Wallet Session Management: A Complete Solution from Connection to Disconnection"
date: 2025-06-20 19:10:34
tags:
  - Web3
  - DApp
readingTime: 9
description: "A systematic guide to DApp wallet session lifecycle management, covering persistence, auto-reconnection, network switching detection, multi-wallet concurrency, and mobile adaptation"
wordCount: 505
---

## Wallet Session Lifecycle

Wallet session management for DApps is an often overlooked but critically important area. A robust session management system needs to handle connection, reconnection, network switching, multi-wallet concurrency, secure disconnection, and other scenarios.

The complete lifecycle of a wallet session:

```
┌──────────┐   connect()   ┌──────────┐   page refresh   ┌──────────┐
│  Not      │ ────────────▶│ Connected │ ────────────────▶│  Auto     │
│  Connected│               │           │                  │ Reconnect │
│  idle     │               │ connected │                  │ reconnect │
└──────────┘               └──────────┘                  └─────┬────┘
      ▲                          │                              │
      │     disconnect()         │         chain changed         │
      │────────────────────────  │◀─────────────────────────────┘
      │                          │
      │                          ▼
      │                    ┌──────────┐   account changed   ┌──────────┐
      │                    │ Network   │ ──────────────────▶ │  State    │
      │                    │ Switched  │                     │  Sync     │
      │                    │ switched  │                     │  sync     │
      │                    └──────────┘                     └──────────┘
      │                          │
      │    session expired       │
      └──────────────────────────┘
```

## Session Persistence: localStorage / sessionStorage / cookie

Session persistence is key to restoring connections after page refresh. The three storage options each have trade-offs:

| Option | Persistence | Security | Use Case |
|------|--------|--------|----------|
| localStorage | Permanent | Low (XSS readable) | Desktop long-term sessions |
| sessionStorage | Within tab | Medium | Temporary sessions |
| Cookie | Configurable | Medium (HttpOnly) | Server-side validation scenarios |

Recommended approach: **Store connection info in localStorage (no private keys), auto-reconnect after refresh**. Don't store any sensitive data — only store the wallet type and address, and re-request authorization on reconnect.

```typescript
// Session data structure
interface WalletSession {
  walletType: WalletType    // Wallet type
  address: Address          // Wallet address
  chainId: number           // Current chain ID
  connectedAt: number       // Connection timestamp
  lastActiveAt: number      // Last active time
  expiresAt: number         // Expiration time
}

type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'rainbow' | 'injected'

// Session storage
class SessionStorage {
  private static STORAGE_KEY = 'dapp:wallet_session'
  private static TTL = 7 * 24 * 60 * 60 * 1000 // 7-day expiration

  static save(session: WalletSession): void {
    try {
      const data = { ...session, expiresAt: Date.now() + this.TTL }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Failed to save session:', e)
    }
  }

  static load(): WalletSession | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY)
      if (!raw) return null

      const session = JSON.parse(raw) as WalletSession

      // Check expiration
      if (Date.now() > session.expiresAt) {
        this.clear()
        return null
      }

      return session
    } catch {
      return null
    }
  }

  static clear(): void {
    localStorage.removeItem(this.STORAGE_KEY)
  }

  static update(updater: (session: WalletSession) => WalletSession): void {
    const current = this.load()
    if (current) {
      this.save(updater(current))
    }
  }
}
```

## Auto-Reconnection Strategy: Connection Recovery After Page Refresh

After a page refresh, the frontend should automatically attempt to restore the previous session. The reconnection strategy needs to handle various failure scenarios:

```typescript
class WalletReconnector {
  private providers: Map<WalletType, EIP1193Provider> = new Map()
  private maxRetries = 3
  private retryDelay = 1000

  constructor(providers: Map<WalletType, EIP1193Provider>) {
    this.providers = providers
  }

  async reconnect(): Promise<WalletSession | null> {
    const savedSession = SessionStorage.load()
    if (!savedSession) return null

    const provider = this.providers.get(savedSession.walletType)
    if (!provider) {
      SessionStorage.clear()
      return null
    }

    // WalletConnect needs to restore session
    if (savedSession.walletType === 'walletconnect') {
      return this.reconnectWalletConnect(savedSession)
    }

    // Injected wallets (MetaMask, etc.) attempt silent connect
    return this.reconnectInjected(provider, savedSession)
  }

  private async reconnectInjected(
    provider: EIP1193Provider,
    savedSession: WalletSession,
  ): Promise<WalletSession | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Request account authorization (silent mode, no popup)
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        }) as string[]

        // Verify address matches
        if (accounts[0]?.toLowerCase() !== savedSession.address.toLowerCase()) {
          // Address changed, need to reconnect
          SessionStorage.clear()
          return null
        }

        // Verify chain ID
        const chainId = await provider.request({ method: 'eth_chainId' })
        const currentChainId = parseInt(chainId, 16)

        const session: WalletSession = {
          ...savedSession,
          chainId: currentChainId,
          lastActiveAt: Date.now(),
        }

        SessionStorage.save(session)
        return session
      } catch (error: any) {
        if (error.code === 4001) {
          // User rejected the connection
          SessionStorage.clear()
          return null
        }

        // Other errors, delay and retry
        if (attempt < this.maxRetries - 1) {
          await new Promise((r) => setTimeout(r, this.retryDelay * (attempt + 1)))
        }
      }
    }

    SessionStorage.clear()
    return null
  }

  private async reconnectWalletConnect(
    savedSession: WalletSession,
  ): Promise<WalletSession | null> {
    // WalletConnect reconnection is handled by its SDK
    // Check if session is still active
    const wcClient = this.getWalletConnectClient()
    if (!wcClient?.session) {
      SessionStorage.clear()
      return null
    }

    return {
      ...savedSession,
      lastActiveAt: Date.now(),
    }
  }

  private getWalletConnectClient() {
    // Return WalletConnect client instance
    return null
  }
}
```

## Network Switching Detection and State Synchronization

Users may switch networks in their wallet at any time. The frontend must listen for `chainChanged` events and synchronize state:

```typescript
class NetworkManager {
  private currentChainId: number
  private listeners: Set<(chainId: number) => void> = new Set()
  private provider: EIP1193Provider
  private supportedChains: Set<number>

  constructor(
    provider: EIP1193Provider,
    initialChainId: number,
    supportedChains: number[],
  ) {
    this.provider = provider
    this.currentChainId = initialChainId
    this.supportedChains = new Set(supportedChains)
    this.setupListeners()
  }

  private setupListeners() {
    // Chain switch
    this.provider.on('chainChanged', (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      this.handleChainChange(newChainId)
    })

    // Account switch
    this.provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        this.handleDisconnect()
      } else {
        this.handleAccountChange(accounts[0] as Address)
      }
    })

    // Disconnect (EIP-1193)
    this.provider.on('disconnect', (error: { code: number; message: string }) => {
      this.handleDisconnect()
    })
  }

  private handleChainChange(newChainId: number) {
    if (newChainId === this.currentChainId) return

    this.currentChainId = newChainId

    // Update session
    SessionStorage.update((s) => ({ ...s, chainId: newChainId }))

    // Check if supported
    const supported = this.supportedChains.has(newChainId)

    // Notify all listeners
    this.listeners.forEach((listener) => listener(newChainId))

    if (!supported) {
      // Prompt user to switch to a supported chain
      this.promptSwitchNetwork()
    }
  }

  private handleAccountChange(newAddress: Address) {
    SessionStorage.update((s) => ({
      ...s,
      address: newAddress,
      lastActiveAt: Date.now(),
    }))

    // Clear cache data not related to the new address
    this.clearUserSpecificCache()
  }

  private handleDisconnect() {
    SessionStorage.clear()
    this.listeners.forEach((listener) => listener(0)) // 0 means disconnected
  }

  // Request switch to specified chain
  async requestSwitchChain(targetChainId: number): Promise<boolean> {
    const chainIdHex = `0x${targetChainId.toString(16)}`

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return true
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        return this.requestAddChain(targetChainId)
      }
      throw error
    }
  }

  private async requestAddChain(chainId: number): Promise<boolean> {
    const chainConfig = getChainConfig(chainId)
    try {
      await this.provider.request({
        method: 'wallet_addEthereumChain',
        params: [chainConfig],
      })
      return true
    } catch {
      return false
    }
  }

  onChainChanged(listener: (chainId: number) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private promptSwitchNetwork() {
    // Show network mismatch UI prompt
  }

  private clearUserSpecificCache() {
    // Clear user-related cache
  }
}
```

## Multi-Wallet Concurrent Management

Users may connect multiple wallets simultaneously. DApps need to manage multiple providers and select the active wallet:

```typescript
class MultiWalletManager {
  private wallets: Map<WalletType, {
    provider: EIP1193Provider
    address: Address
    chainId: number
    isActive: boolean
  }> = new Map()
  private activeWallet: WalletType | null = null

  // Connect wallet
  async connect(
    walletType: WalletType,
    provider: EIP1193Provider,
  ): Promise<{ address: Address; chainId: number }> {
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    }) as string[]
    const chainId = parseInt(
      await provider.request({ method: 'eth_chainId' }) as string,
      16,
    )

    const address = accounts[0] as Address

    this.wallets.set(walletType, {
      provider,
      address,
      chainId,
      isActive: true,
    })

    // If no active wallet, set as current
    if (!this.activeWallet) {
      this.activeWallet = walletType
    }

    // Save session
    SessionStorage.save({
      walletType,
      address,
      chainId,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })

    return { address, chainId }
  }

  // Switch active wallet
  setActiveWallet(walletType: WalletType): void {
    if (!this.wallets.has(walletType)) {
      throw new Error(`Wallet ${walletType} not connected`)
    }

    // Deactivate other wallets
    for (const [type, wallet] of this.wallets) {
      wallet.isActive = type === walletType
    }

    this.activeWallet = walletType

    // Update session
    const wallet = this.wallets.get(walletType)!
    SessionStorage.save({
      walletType,
      address: wallet.address,
      chainId: wallet.chainId,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  }

  // Get active wallet
  getActiveWallet() {
    if (!this.activeWallet) return null
    return this.wallets.get(this.activeWallet)!
  }

  // Disconnect specified wallet
  async disconnect(walletType?: WalletType): Promise<void> {
    const type = walletType || this.activeWallet
    if (!type) return

    const wallet = this.wallets.get(type)
    if (!wallet) return

    // Clean up listeners
    wallet.provider.removeAllListeners?.()

    this.wallets.delete(type)

    if (this.activeWallet === type) {
      // Switch to another connected wallet
      const remaining = Array.from(this.wallets.keys())
      if (remaining.length > 0) {
        this.setActiveWallet(remaining[0])
      } else {
        this.activeWallet = null
        SessionStorage.clear()
      }
    }
  }

  // List all connected wallets
  listConnected(): { type: WalletType; address: Address; chainId: number }[] {
    return Array.from(this.wallets.entries()).map(([type, wallet]) => ({
      type,
      address: wallet.address,
      chainId: wallet.chainId,
    }))
  }
}
```

## Session Expiration and Secure Disconnection

Secure disconnection is not just about clearing state — it also needs to notify the wallet, clean up event listeners, and revoke authorization:

```typescript
class SessionManager {
  private networkManager: NetworkManager | null = null
  private multiWallet: MultiWalletManager
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(multiWallet: MultiWalletManager) {
    this.multiWallet = multiWallet
  }

  // Start session heartbeat
  startHeartbeat(intervalMs: number = 60000) {
    this.heartbeatInterval = setInterval(() => {
      const session = SessionStorage.load()
      if (!session) {
        this.terminate()
        return
      }

      // Update last active time
      SessionStorage.update((s) => ({
        ...s,
        lastActiveAt: Date.now(),
      }))
    }, intervalMs)
  }

  // Secure disconnect
  async terminate(): Promise<void> {
    // 1. Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 2. Disconnect all wallets
    await this.multiWallet.disconnect()

    // 3. Clear session storage
    SessionStorage.clear()

    // 4. Clean up network listeners
    this.networkManager?.destroy()

    // 5. Clean up user-related cache
    this.clearUserCache()

    // 6. Reset state
    this.networkManager = null
  }

  private clearUserCache() {
    // Clear SWR/React Query cache
    // Clear user preferences in localStorage
    // Clear sessionStorage
    const keysToKeep = ['theme', 'language']
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      if (!keysToKeep.includes(key) && key.startsWith('dapp:')) {
        localStorage.removeItem(key)
      }
    }
  }
}
```

## Complete Wallet Session Manager

Integrating the above components into a unified session manager:

```typescript
class WalletSessionManager {
  private multiWallet: MultiWalletManager
  private reconnector: WalletReconnector
  private networkManager: NetworkManager | null = null
  private sessionManager: SessionManager
  private state: SessionState = { status: 'disconnected' }

  // State types
  // { status: 'disconnected' }
  // { status: 'connecting', walletType: WalletType }
  // { status: 'connected', address: Address, chainId: number, walletType: WalletType }
  // { status: 'reconnecting' }
  // { status: 'error', message: string }

  private listeners: Set<(state: SessionState) => void> = new Set()

  constructor(config: {
    providers: Map<WalletType, EIP1193Provider>
    supportedChains: number[]
  }) {
    this.multiWallet = new MultiWalletManager()
    this.reconnector = new WalletReconnector(config.providers)
    this.sessionManager = new SessionManager(this.multiWallet)
  }

  // Initialize: attempt auto-reconnect
  async init(): Promise<void> {
    this.setState({ status: 'reconnecting' })

    const session = await this.reconnector.reconnect()

    if (session) {
      const provider = this.getProvider(session.walletType)
      this.networkManager = new NetworkManager(
        provider,
        session.chainId,
        this.getSupportedChains(),
      )
      this.setState({
        status: 'connected',
        address: session.address,
        chainId: session.chainId,
        walletType: session.walletType,
      })
      this.sessionManager.startHeartbeat()
    } else {
      this.setState({ status: 'disconnected' })
    }
  }

  // Connect wallet
  async connect(walletType: WalletType): Promise<void> {
    this.setState({ status: 'connecting', walletType })

    try {
      const provider = this.getProvider(walletType)
      const { address, chainId } = await this.multiWallet.connect(walletType, provider)

      this.networkManager = new NetworkManager(
        provider,
        chainId,
        this.getSupportedChains(),
      )

      this.setState({
        status: 'connected',
        address,
        chainId,
        walletType,
      })

      this.sessionManager.startHeartbeat()
    } catch (error: any) {
      this.setState({ status: 'error', message: error.message })
      throw error
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    await this.sessionManager.terminate()
    this.setState({ status: 'disconnected' })
  }

  // Switch active wallet
  switchWallet(walletType: WalletType): void {
    this.multiWallet.setActiveWallet(walletType)
    const wallet = this.multiWallet.getActiveWallet()
    if (wallet) {
      this.setState({
        status: 'connected',
        address: wallet.address,
        chainId: wallet.chainId,
        walletType,
      })
    }
  }

  // State subscription
  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private setState(state: SessionState) {
    this.state = state
    this.listeners.forEach((l) => l(state))
  }

  private getProvider(walletType: WalletType): EIP1193Provider {
    // Return the corresponding provider
    throw new Error('Not implemented')
  }

  private getSupportedChains(): number[] {
    return [1, 10, 137, 42161, 8453]
  }
}
```

## Error Recovery: Connection Interruption, RPC Timeout

When the network is unstable or the wallet extension crashes, the frontend needs to recover gracefully:

```typescript
class ConnectionRecovery {
  private healthCheckInterval: NodeJS.Timeout | null = null
  private consecutiveFailures = 0
  private maxFailures = 5

  constructor(
    private provider: EIP1193Provider,
    private onUnhealthy: () => void,
    private onRecovered: () => void,
  ) {}

  startHealthCheck(intervalMs: number = 30000) {
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth()
      if (!healthy) {
        this.consecutiveFailures++
        if (this.consecutiveFailures >= this.maxFailures) {
          this.onUnhealthy()
        }
      } else {
        if (this.consecutiveFailures >= this.maxFailures) {
          this.onRecovered()
        }
        this.consecutiveFailures = 0
      }
    }, intervalMs)
  }

  private async checkHealth(): Promise<boolean> {
    try {
      await this.provider.request({ method: 'eth_blockNumber' })
      return true
    } catch {
      return false
    }
  }

  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}
```

## Mobile DApp Browser Session Specifics

Mobile DApp browsers (such as MetaMask App, TokenPocket) have significantly different session management from desktop:

- **No extension injection**: Provider is injected via WebView, not `window.ethereum`
- **Short session lifecycle**: App backgrounding may cause WebView to be reclaimed
- **WalletConnect path**: Jumps to wallet app via deep link
- **Limited network switching**: Some mobile wallets don't support `wallet_switchEthereumChain`

```typescript
// Mobile detection and adaptation
class MobileAdapter {
  static isMobile(): boolean {
    return /Android|iPhone|iPad/i.test(navigator.userAgent)
  }

  static isDAppBrowser(): boolean {
    // Detect if running inside a wallet app's DApp browser
    return typeof (window as any).ethereum !== 'undefined' &&
           (window as any).ethereum.isMetaMask &&
           this.isMobile()
  }

  static isWalletConnectNeeded(): boolean {
    // Mobile browsers (non-DApp browsers) need WalletConnect
    return this.isMobile() && !this.isDAppBrowser()
  }

  // Mobile session management special handling
  static getSessionConfig() {
    if (this.isDAppBrowser()) {
      return {
        // In DApp browser: session follows WebView lifecycle
        storage: 'sessionStorage' as const,
        heartbeatInterval: 15000, // More frequent heartbeat
        reconnectOnVisible: true,  // Reconnect when app returns to foreground
      }
    }

    if (this.isWalletConnectNeeded()) {
      return {
        storage: 'localStorage' as const,
        heartbeatInterval: 30000,
        reconnectOnVisible: false,
      }
    }

    return {
      storage: 'localStorage' as const,
      heartbeatInterval: 60000,
      reconnectOnVisible: false,
    }
  }

  // App visibility listener (mobile-specific)
  static onAppVisible(callback: () => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        callback()
      }
    })
  }
}
```

## Best Practices: Unified Connection State Management

1. **Single source of truth**: All components get state from the same SessionManager, avoiding multiple components managing connections independently
2. **Optimistic updates**: Immediately show "connecting" state after the user clicks connect, don't wait for RPC response
3. **Graceful degradation**: Provide WalletConnect fallback when wallet is unavailable
4. **Session expiration prompts**: Alert users when sessions are about to expire
5. **Multi-chain awareness**: Automatically clear old chain data cache on network switch
6. **Mobile adaptation**: Detect runtime environment and adjust session strategy

## Summary

Wallet session management is the infrastructure of DApp frontends. A robust session system needs to correctly handle connection, reconnection, network switching, multi-wallet concurrency, and secure disconnection. localStorage persistence + auto-reconnection is key to restoring user experience. Network switching detection and state synchronization are guarantees against data inconsistency. The specifics of mobile DApp browsers require adaptation strategies. Encapsulating all logic in a unified SessionManager and exposing state through a subscription pattern is the current best practice. As EIP-6963 (multi-injected wallet discovery) becomes widely adopted, multi-wallet concurrent management will become standard, and frontend session architectures should prepare for this.
