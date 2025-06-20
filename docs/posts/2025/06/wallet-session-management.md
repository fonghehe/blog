---
title: "DApp 钱包会话管理：从连接到断开的完整方案"
date: 2025-06-20 19:10:34
tags:
  - Web3
  - DApp
readingTime: 12
description: "系统性讲解 DApp 钱包会话的生命周期管理，涵盖持久化、自动重连、网络切换检测、多钱包并发及移动端适配"
wordCount: 3600
---

## 钱包会话的生命周期

DApp 的钱包会话管理是一个常被忽视但极其重要的领域。一个健壮的会话管理系统需要处理连接、重连、网络切换、多钱包并发、安全断开等场景。

钱包会话的完整生命周期：

```
┌──────────┐   connect()   ┌──────────┐   page refresh   ┌──────────┐
│  未连接    │ ────────────▶│  已连接    │ ────────────────▶│  自动重连  │
│  idle     │               │ connected │                  │ reconnect │
└──────────┘               └──────────┘                  └─────┬────┘
      ▲                          │                              │
      │     disconnect()         │         chain changed         │
      │────────────────────────  │◀─────────────────────────────┘
      │                          │
      │                          ▼
      │                    ┌──────────┐   account changed   ┌──────────┐
      │                    │  网络切换  │ ──────────────────▶ │  状态同步  │
      │                    │ switched  │                     │  sync     │
      │                    └──────────┘                     └──────────┘
      │                          │
      │    session expired       │
      └──────────────────────────┘
```

## 会话持久化：localStorage / sessionStorage / cookie

会话持久化是页面刷新后恢复连接的关键。三种存储方案各有取舍：

| 方案 | 持久性 | 安全性 | 适用场景 |
|------|--------|--------|----------|
| localStorage | 永久 | 低（XSS 可读）| 桌面端长期会话 |
| sessionStorage | 标签页内 | 中 | 临时会话 |
| Cookie | 可配置 | 中（HttpOnly）| 服务端验证场景 |

推荐方案：**localStorage 存储连接信息（不含私钥），刷新后自动重连**。不存储任何敏感数据，只存储钱包类型和地址，重连时重新请求授权。

```typescript
// 会话数据结构
interface WalletSession {
  walletType: WalletType    // 钱包类型
  address: Address          // 钱包地址
  chainId: number           // 当前链 ID
  connectedAt: number       // 连接时间戳
  lastActiveAt: number      // 最后活跃时间
  expiresAt: number         // 过期时间
}

type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'rainbow' | 'injected'

// 会话存储器
class SessionStorage {
  private static STORAGE_KEY = 'dapp:wallet_session'
  private static TTL = 7 * 24 * 60 * 60 * 1000 // 7 天过期

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

      // 检查过期
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

## 自动重连策略：页面刷新后的连接恢复

页面刷新后，前端应自动尝试恢复之前的会话。重连策略需要处理多种失败场景：

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

    // WalletConnect 需要恢复 session
    if (savedSession.walletType === 'walletconnect') {
      return this.reconnectWalletConnect(savedSession)
    }

    // Injected 钱包（MetaMask 等）尝试 silent connect
    return this.reconnectInjected(provider, savedSession)
  }

  private async reconnectInjected(
    provider: EIP1193Provider,
    savedSession: WalletSession,
  ): Promise<WalletSession | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // 请求账号授权（silent 模式，不弹窗）
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        }) as string[]

        // 验证地址是否一致
        if (accounts[0]?.toLowerCase() !== savedSession.address.toLowerCase()) {
          // 地址变了，需要重新连接
          SessionStorage.clear()
          return null
        }

        // 验证链 ID
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
          // 用户拒绝了连接
          SessionStorage.clear()
          return null
        }

        // 其他错误，延迟重试
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
    // WalletConnect 的重连由其 SDK 处理
    // 检查 session 是否还活跃
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
    // 返回 WalletConnect 客户端实例
    return null
  }
}
```

## 网络切换检测与状态同步

用户可能随时在钱包中切换网络。前端必须监听 `chainChanged` 事件并同步状态：

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
    // 链切换
    this.provider.on('chainChanged', (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      this.handleChainChange(newChainId)
    })

    // 账号切换
    this.provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        // 用户断开了连接
        this.handleDisconnect()
      } else {
        this.handleAccountChange(accounts[0] as Address)
      }
    })

    // 断开连接（EIP-1193）
    this.provider.on('disconnect', (error: { code: number; message: string }) => {
      this.handleDisconnect()
    })
  }

  private handleChainChange(newChainId: number) {
    if (newChainId === this.currentChainId) return

    this.currentChainId = newChainId

    // 更新会话
    SessionStorage.update((s) => ({ ...s, chainId: newChainId }))

    // 检查是否支持
    const supported = this.supportedChains.has(newChainId)

    // 通知所有监听器
    this.listeners.forEach((listener) => listener(newChainId))

    if (!supported) {
      // 提示用户切换到支持的链
      this.promptSwitchNetwork()
    }
  }

  private handleAccountChange(newAddress: Address) {
    SessionStorage.update((s) => ({
      ...s,
      address: newAddress,
      lastActiveAt: Date.now(),
    }))

    // 清空与新地址无关的缓存数据
    this.clearUserSpecificCache()
  }

  private handleDisconnect() {
    SessionStorage.clear()
    this.listeners.forEach((listener) => listener(0)) // 0 表示断开
  }

  // 请求切换到指定链
  async requestSwitchChain(targetChainId: number): Promise<boolean> {
    const chainIdHex = `0x${targetChainId.toString(16)}`

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return true
    } catch (error: any) {
      // 链未添加，尝试添加
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
    // 显示网络不匹配的 UI 提示
  }

  private clearUserSpecificCache() {
    // 清除用户相关的缓存
  }
}
```

## 多钱包并发管理

用户可能同时连接多个钱包。DApp 需要管理多个 provider 并选择活跃钱包：

```typescript
class MultiWalletManager {
  private wallets: Map<WalletType, {
    provider: EIP1193Provider
    address: Address
    chainId: number
    isActive: boolean
  }> = new Map()
  private activeWallet: WalletType | null = null

  // 连接钱包
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

    // 如果没有活跃钱包，设为当前
    if (!this.activeWallet) {
      this.activeWallet = walletType
    }

    // 保存会话
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

  // 切换活跃钱包
  setActiveWallet(walletType: WalletType): void {
    if (!this.wallets.has(walletType)) {
      throw new Error(`Wallet ${walletType} not connected`)
    }

    // 取消其他钱包的活跃状态
    for (const [type, wallet] of this.wallets) {
      wallet.isActive = type === walletType
    }

    this.activeWallet = walletType

    // 更新会话
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

  // 获取活跃钱包
  getActiveWallet() {
    if (!this.activeWallet) return null
    return this.wallets.get(this.activeWallet)!
  }

  // 断开指定钱包
  async disconnect(walletType?: WalletType): Promise<void> {
    const type = walletType || this.activeWallet
    if (!type) return

    const wallet = this.wallets.get(type)
    if (!wallet) return

    // 清理监听器
    wallet.provider.removeAllListeners?.()

    this.wallets.delete(type)

    if (this.activeWallet === type) {
      // 切换到其他已连接钱包
      const remaining = Array.from(this.wallets.keys())
      if (remaining.length > 0) {
        this.setActiveWallet(remaining[0])
      } else {
        this.activeWallet = null
        SessionStorage.clear()
      }
    }
  }

  // 列出所有已连接钱包
  listConnected(): { type: WalletType; address: Address; chainId: number }[] {
    return Array.from(this.wallets.entries()).map(([type, wallet]) => ({
      type,
      address: wallet.address,
      chainId: wallet.chainId,
    }))
  }
}
```

## 会话过期与安全断开

安全断开不仅仅是清理状态——还需要通知钱包、清理事件监听器、撤销授权：

```typescript
class SessionManager {
  private networkManager: NetworkManager | null = null
  private multiWallet: MultiWalletManager
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(multiWallet: MultiWalletManager) {
    this.multiWallet = multiWallet
  }

  // 启动会话心跳
  startHeartbeat(intervalMs: number = 60000) {
    this.heartbeatInterval = setInterval(() => {
      const session = SessionStorage.load()
      if (!session) {
        this.terminate()
        return
      }

      // 更新最后活跃时间
      SessionStorage.update((s) => ({
        ...s,
        lastActiveAt: Date.now(),
      }))
    }, intervalMs)
  }

  // 安全断开
  async terminate(): Promise<void> {
    // 1. 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 2. 断开所有钱包
    await this.multiWallet.disconnect()

    // 3. 清理会话存储
    SessionStorage.clear()

    // 4. 清理网络监听器
    this.networkManager?.destroy()

    // 5. 清理用户相关缓存
    this.clearUserCache()

    // 6. 重置状态
    this.networkManager = null
  }

  private clearUserCache() {
    // 清除 SWR/React Query 缓存
    // 清除 localStorage 中的用户偏好
    // 清除 sessionStorage
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

## 完整的钱包会话管理器

将上述组件整合为一个统一的会话管理器：

```typescript
class WalletSessionManager {
  private multiWallet: MultiWalletManager
  private reconnector: WalletReconnector
  private networkManager: NetworkManager | null = null
  private sessionManager: SessionManager
  private state: SessionState = { status: 'disconnected' }

  // 状态类型
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

  // 初始化：尝试自动重连
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

  // 连接钱包
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

  // 断开连接
  async disconnect(): Promise<void> {
    await this.sessionManager.terminate()
    this.setState({ status: 'disconnected' })
  }

  // 切换活跃钱包
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

  // 状态订阅
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
    // 返回对应的 provider
    throw new Error('Not implemented')
  }

  private getSupportedChains(): number[] {
    return [1, 10, 137, 42161, 8453]
  }
}
```

## 错误恢复：连接中断、RPC 超时

网络不稳定或钱包扩展崩溃时，前端需要优雅恢复：

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

## 移动端 DApp 浏览器的会话特殊性

移动端 DApp 浏览器（如 MetaMask App、TokenPocket）的会话管理与桌面端有显著差异：

- **无扩展注入**：provider 通过 WebView 注入，而非 `window.ethereum`
- **会话生命周期短**：App 切后台可能导致 WebView 被回收
- **WalletConnect 路径**：通过深度链接跳转到钱包 App
- **网络切换受限**：部分移动端钱包不支持 `wallet_switchEthereumChain`

```typescript
// 移动端检测与适配
class MobileAdapter {
  static isMobile(): boolean {
    return /Android|iPhone|iPad/i.test(navigator.userAgent)
  }

  static isDAppBrowser(): boolean {
    // 检测是否在钱包 App 的 DApp 浏览器中
    return typeof (window as any).ethereum !== 'undefined' &&
           (window as any).ethereum.isMetaMask &&
           this.isMobile()
  }

  static isWalletConnectNeeded(): boolean {
    // 移动端浏览器（非 DApp 浏览器）需要 WalletConnect
    return this.isMobile() && !this.isDAppBrowser()
  }

  // 移动端会话管理特殊处理
  static getSessionConfig() {
    if (this.isDAppBrowser()) {
      return {
        // DApp 浏览器中：会话跟随 WebView 生命周期
        storage: 'sessionStorage' as const,
        heartbeatInterval: 15000, // 更频繁的心跳
        reconnectOnVisible: true,  // App 回到前台时重连
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

  // App 可见性监听（移动端特有）
  static onAppVisible(callback: () => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        callback()
      }
    })
  }
}
```

## 最佳实践：统一的连接状态管理

1. **单一数据源**：所有组件从同一个 SessionManager 获取状态，避免多个组件各自管理连接
2. **乐观更新**：用户点击连接后立即显示连接中状态，不要等待 RPC 响应
3. **优雅降级**：钱包不可用时提供 WalletConnect 回退方案
4. **会话过期提示**：在会话即将过期时提示用户续期
5. **多链感知**：网络切换时自动清理旧链的数据缓存
6. **移动端适配**：检测运行环境，调整会话策略

## 小结

钱包会话管理是 DApp 前端的基础设施。一个健壮的会话系统需要在连接、重连、网络切换、多钱包并发和安全断开等环节都做到正确处理。localStorage 持久化 + 自动重连是恢复用户体验的关键。网络切换检测和状态同步是避免数据不一致的保障。移动端 DApp 浏览器的特殊性要求适配策略。将所有逻辑封装在一个统一的 SessionManager 中，通过订阅模式暴露状态，是当前最佳实践。随着 EIP-6963（多注入钱包发现）的普及，多钱包并发管理将成为标配，前端的会话架构应为此做好准备。
