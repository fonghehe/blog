---
title: "DApp 錢包會話管理：從連接到斷開的完整方案"
date: 2025-06-20 19:10:34
tags:
  - Web3
  - DApp
readingTime: 9
description: "系統性講解 DApp 錢包會話的生命週期管理，涵蓋持久化、自動重連、網絡切換檢測、多錢包併發及移動端適配"
wordCount: 902
---

## 錢包會話的生命週期

DApp 的錢包會話管理是一個常被忽視但極其重要的領域。一個健壯的會話管理系統需要處理連接、重連、網絡切換、多錢包併發、安全斷開等場景。

錢包會話的完整生命週期：

```
┌──────────┐   connect()   ┌──────────┐   page refresh   ┌──────────┐
│  未連接    │ ────────────▶│  已連接    │ ────────────────▶│  自動重連  │
│  idle     │               │ connected │                  │ reconnect │
└──────────┘               └──────────┘                  └─────┬────┘
      ▲                          │                              │
      │     disconnect()         │         chain changed         │
      │────────────────────────  │◀─────────────────────────────┘
      │                          │
      │                          ▼
      │                    ┌──────────┐   account changed   ┌──────────┐
      │                    │  網絡切換  │ ──────────────────▶ │  狀態同步  │
      │                    │ switched  │                     │  sync     │
      │                    └──────────┘                     └──────────┘
      │                          │
      │    session expired       │
      └──────────────────────────┘
```

## 會話持久化：localStorage / sessionStorage / cookie

會話持久化是頁面刷新後恢復連接的關鍵。三種存儲方案各有取捨：

| 方案 | 持久性 | 安全性 | 適用場景 |
|------|--------|--------|----------|
| localStorage | 永久 | 低（XSS 可讀）| 桌面端長期會話 |
| sessionStorage | 標籤頁內 | 中 | 臨時會話 |
| Cookie | 可配置 | 中（HttpOnly）| 服務端驗證場景 |

推薦方案：**localStorage 存儲連接信息（不含私鑰），刷新後自動重連**。不存儲任何敏感數據，只存儲錢包類型和地址，重連時重新請求授權。

```typescript
// 會話數據結構
interface WalletSession {
  walletType: WalletType    // 錢包類型
  address: Address          // 錢包地址
  chainId: number           // 當前鏈 ID
  connectedAt: number       // 連接時間戳
  lastActiveAt: number      // 最後活躍時間
  expiresAt: number         // 過期時間
}

type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'rainbow' | 'injected'

// 會話存儲器
class SessionStorage {
  private static STORAGE_KEY = 'dapp:wallet_session'
  private static TTL = 7 * 24 * 60 * 60 * 1000 // 7 天過期

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

      // 檢查過期
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

## 自動重連策略：頁面刷新後的連接恢復

頁面刷新後，前端應自動嘗試恢復之前的會話。重連策略需要處理多種失敗場景：

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

    // WalletConnect 需要恢復 session
    if (savedSession.walletType === 'walletconnect') {
      return this.reconnectWalletConnect(savedSession)
    }

    // Injected 錢包（MetaMask 等）嘗試 silent connect
    return this.reconnectInjected(provider, savedSession)
  }

  private async reconnectInjected(
    provider: EIP1193Provider,
    savedSession: WalletSession,
  ): Promise<WalletSession | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // 請求賬號授權（silent 模式，不彈窗）
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        }) as string[]

        // 驗證地址是否一致
        if (accounts[0]?.toLowerCase() !== savedSession.address.toLowerCase()) {
          // 地址變了，需要重新連接
          SessionStorage.clear()
          return null
        }

        // 驗證鏈 ID
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
          // 用戶拒絕了連接
          SessionStorage.clear()
          return null
        }

        // 其他錯誤，延遲重試
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
    // WalletConnect 的重連由其 SDK 處理
    // 檢查 session 是否還活躍
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
    // 返回 WalletConnect 客戶端實例
    return null
  }
}
```

## 網絡切換檢測與狀態同步

用戶可能隨時在錢包中切換網絡。前端必須監聽 `chainChanged` 事件並同步狀態：

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
    // 鏈切換
    this.provider.on('chainChanged', (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      this.handleChainChange(newChainId)
    })

    // 賬號切換
    this.provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        // 用戶斷開了連接
        this.handleDisconnect()
      } else {
        this.handleAccountChange(accounts[0] as Address)
      }
    })

    // 斷開連接（EIP-1193）
    this.provider.on('disconnect', (error: { code: number; message: string }) => {
      this.handleDisconnect()
    })
  }

  private handleChainChange(newChainId: number) {
    if (newChainId === this.currentChainId) return

    this.currentChainId = newChainId

    // 更新會話
    SessionStorage.update((s) => ({ ...s, chainId: newChainId }))

    // 檢查是否支持
    const supported = this.supportedChains.has(newChainId)

    // 通知所有監聽器
    this.listeners.forEach((listener) => listener(newChainId))

    if (!supported) {
      // 提示用戶切換到支持的鏈
      this.promptSwitchNetwork()
    }
  }

  private handleAccountChange(newAddress: Address) {
    SessionStorage.update((s) => ({
      ...s,
      address: newAddress,
      lastActiveAt: Date.now(),
    }))

    // 清空與新地址無關的緩存數據
    this.clearUserSpecificCache()
  }

  private handleDisconnect() {
    SessionStorage.clear()
    this.listeners.forEach((listener) => listener(0)) // 0 表示斷開
  }

  // 請求切換到指定鏈
  async requestSwitchChain(targetChainId: number): Promise<boolean> {
    const chainIdHex = `0x${targetChainId.toString(16)}`

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return true
    } catch (error: any) {
      // 鏈未添加，嘗試添加
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
    // 顯示網絡不匹配的 UI 提示
  }

  private clearUserSpecificCache() {
    // 清除用戶相關的緩存
  }
}
```

## 多錢包併發管理

用戶可能同時連接多個錢包。DApp 需要管理多個 provider 並選擇活躍錢包：

```typescript
class MultiWalletManager {
  private wallets: Map<WalletType, {
    provider: EIP1193Provider
    address: Address
    chainId: number
    isActive: boolean
  }> = new Map()
  private activeWallet: WalletType | null = null

  // 連接錢包
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

    // 如果沒有活躍錢包，設為當前
    if (!this.activeWallet) {
      this.activeWallet = walletType
    }

    // 保存會話
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

  // 切換活躍錢包
  setActiveWallet(walletType: WalletType): void {
    if (!this.wallets.has(walletType)) {
      throw new Error(`Wallet ${walletType} not connected`)
    }

    // 取消其他錢包的活躍狀態
    for (const [type, wallet] of this.wallets) {
      wallet.isActive = type === walletType
    }

    this.activeWallet = walletType

    // 更新會話
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

  // 獲取活躍錢包
  getActiveWallet() {
    if (!this.activeWallet) return null
    return this.wallets.get(this.activeWallet)!
  }

  // 斷開指定錢包
  async disconnect(walletType?: WalletType): Promise<void> {
    const type = walletType || this.activeWallet
    if (!type) return

    const wallet = this.wallets.get(type)
    if (!wallet) return

    // 清理監聽器
    wallet.provider.removeAllListeners?.()

    this.wallets.delete(type)

    if (this.activeWallet === type) {
      // 切換到其他已連接錢包
      const remaining = Array.from(this.wallets.keys())
      if (remaining.length > 0) {
        this.setActiveWallet(remaining[0])
      } else {
        this.activeWallet = null
        SessionStorage.clear()
      }
    }
  }

  // 列出所有已連接錢包
  listConnected(): { type: WalletType; address: Address; chainId: number }[] {
    return Array.from(this.wallets.entries()).map(([type, wallet]) => ({
      type,
      address: wallet.address,
      chainId: wallet.chainId,
    }))
  }
}
```

## 會話過期與安全斷開

安全斷開不僅僅是清理狀態——還需要通知錢包、清理事件監聽器、撤銷授權：

```typescript
class SessionManager {
  private networkManager: NetworkManager | null = null
  private multiWallet: MultiWalletManager
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(multiWallet: MultiWalletManager) {
    this.multiWallet = multiWallet
  }

  // 啟動會話心跳
  startHeartbeat(intervalMs: number = 60000) {
    this.heartbeatInterval = setInterval(() => {
      const session = SessionStorage.load()
      if (!session) {
        this.terminate()
        return
      }

      // 更新最後活躍時間
      SessionStorage.update((s) => ({
        ...s,
        lastActiveAt: Date.now(),
      }))
    }, intervalMs)
  }

  // 安全斷開
  async terminate(): Promise<void> {
    // 1. 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 2. 斷開所有錢包
    await this.multiWallet.disconnect()

    // 3. 清理會話存儲
    SessionStorage.clear()

    // 4. 清理網絡監聽器
    this.networkManager?.destroy()

    // 5. 清理用戶相關緩存
    this.clearUserCache()

    // 6. 重置狀態
    this.networkManager = null
  }

  private clearUserCache() {
    // 清除 SWR/React Query 緩存
    // 清除 localStorage 中的用戶偏好
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

## 完整的錢包會話管理器

將上述組件整合為一個統一的會話管理器：

```typescript
class WalletSessionManager {
  private multiWallet: MultiWalletManager
  private reconnector: WalletReconnector
  private networkManager: NetworkManager | null = null
  private sessionManager: SessionManager
  private state: SessionState = { status: 'disconnected' }

  // 狀態類型
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

  // 初始化：嘗試自動重連
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

  // 連接錢包
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

  // 斷開連接
  async disconnect(): Promise<void> {
    await this.sessionManager.terminate()
    this.setState({ status: 'disconnected' })
  }

  // 切換活躍錢包
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

  // 狀態訂閱
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
    // 返回對應的 provider
    throw new Error('Not implemented')
  }

  private getSupportedChains(): number[] {
    return [1, 10, 137, 42161, 8453]
  }
}
```

## 錯誤恢復：連接中斷、RPC 超時

網絡不穩定或錢包擴展崩潰時，前端需要優雅恢復：

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

## 移動端 DApp 瀏覽器的會話特殊性

移動端 DApp 瀏覽器（如 MetaMask App、TokenPocket）的會話管理與桌面端有顯著差異：

- **無擴展注入**：provider 通過 WebView 注入，而非 `window.ethereum`
- **會話生命週期短**：App 切後臺可能導致 WebView 被回收
- **WalletConnect 路徑**：通過深度鏈接跳轉到錢包 App
- **網絡切換受限**：部分移動端錢包不支持 `wallet_switchEthereumChain`

```typescript
// 移動端檢測與適配
class MobileAdapter {
  static isMobile(): boolean {
    return /Android|iPhone|iPad/i.test(navigator.userAgent)
  }

  static isDAppBrowser(): boolean {
    // 檢測是否在錢包 App 的 DApp 瀏覽器中
    return typeof (window as any).ethereum !== 'undefined' &&
           (window as any).ethereum.isMetaMask &&
           this.isMobile()
  }

  static isWalletConnectNeeded(): boolean {
    // 移動端瀏覽器（非 DApp 瀏覽器）需要 WalletConnect
    return this.isMobile() && !this.isDAppBrowser()
  }

  // 移動端會話管理特殊處理
  static getSessionConfig() {
    if (this.isDAppBrowser()) {
      return {
        // DApp 瀏覽器中：會話跟隨 WebView 生命週期
        storage: 'sessionStorage' as const,
        heartbeatInterval: 15000, // 更頻繁的心跳
        reconnectOnVisible: true,  // App 回到前臺時重連
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

  // App 可見性監聽（移動端特有）
  static onAppVisible(callback: () => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        callback()
      }
    })
  }
}
```

## 最佳實踐：統一的連接狀態管理

1. **單一數據源**：所有組件從同一個 SessionManager 獲取狀態，避免多個組件各自管理連接
2. **樂觀更新**：用戶點擊連接後立即顯示連接中狀態，不要等待 RPC 響應
3. **優雅降級**：錢包不可用時提供 WalletConnect 回退方案
4. **會話過期提示**：在會話即將過期時提示用戶續期
5. **多鏈感知**：網絡切換時自動清理舊鏈的數據緩存
6. **移動端適配**：檢測運行環境，調整會話策略

## 小結

錢包會話管理是 DApp 前端的基礎設施。一個健壯的會話系統需要在連接、重連、網絡切換、多錢包併發和安全斷開等環節都做到正確處理。localStorage 持久化 + 自動重連是恢復用戶體驗的關鍵。網絡切換檢測和狀態同步是避免數據不一致的保障。移動端 DApp 瀏覽器的特殊性要求適配策略。將所有邏輯封裝在一個統一的 SessionManager 中，通過訂閱模式暴露狀態，是當前最佳實踐。隨著 EIP-6963（多注入錢包發現）的普及，多錢包併發管理將成為標配，前端的會話架構應為此做好準備。
