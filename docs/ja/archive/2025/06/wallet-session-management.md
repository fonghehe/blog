---
title: "DApp ウォレットセッション管理：接続から切断までの完全ソリューション"
date: 2025-06-20 19:10:34
tags:
  - Web3
  - DApp
readingTime: 11
description: "DApp ウォレットセッションのライフサイクル管理を体系的に解説し、永続化、自動再接続、ネットワーク切り替え検出、マルチウォレット同時接続、モバイル対応をカバー"
wordCount: 1607
---

## ウォレットセッションのライフサイクル

DApp のウォレットセッション管理は見過ごされがちですが、極めて重要な分野です。堅牢なセッション管理システムは、接続、再接続、ネットワーク切り替え、マルチウォレット同時接続、安全な切断などのシナリオを処理する必要があります。

ウォレットセッションの完全なライフサイクル：

```
┌──────────┐   connect()   ┌──────────┐   page refresh   ┌──────────┐
│  未接続    │ ────────────▶│  接続済み  │ ────────────────▶│  自動再接続  │
│  idle     │               │ connected │                  │ reconnect │
└──────────┘               └──────────┘                  └─────┬────┘
      ▲                          │                              │
      │     disconnect()         │         chain changed         │
      │────────────────────────  │◀─────────────────────────────┘
      │                          │
      │                          ▼
      │                    ┌──────────┐   account changed   ┌──────────┐
      │                    │  ネットワーク切り替え│ ──────────────────▶ │  状態同期  │
      │                    │ switched  │                     │  sync     │
      │                    └──────────┘                     └──────────┘
      │                          │
      │    session expired       │
      └──────────────────────────┘
```

## セッション永続化：localStorage / sessionStorage / cookie

セッション永続化はページリフレッシュ後に接続を復元するための鍵です。三つのストレージ方式にはそれぞれトレードオフがあります：

| 方式 | 永続性 | セキュリティ | 適用シナリオ |
|------|--------|--------|----------|
| localStorage | 永続 | 低（XSS で読み取り可能）| デスクトップ長期セッション |
| sessionStorage | タブ内 | 中 | 一時セッション |
| Cookie | 設定可能 | 中（HttpOnly）| サーバー側検証シナリオ |

推奨方式：**localStorage に接続情報を保存（秘密鍵は含まない）、リフレッシュ後に自動再接続**。センシティブなデータは一切保存せず、ウォレットタイプとアドレスのみを保存し、再接続時に再認可をリクエストします。

```typescript
// セッションデータ構造
interface WalletSession {
  walletType: WalletType    // ウォレットタイプ
  address: Address          // ウォレットアドレス
  chainId: number           // 現在のチェーン ID
  connectedAt: number       // 接続タイムスタンプ
  lastActiveAt: number      // 最終アクティブ時間
  expiresAt: number         // 有効期限
}

type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'rainbow' | 'injected'

// セッションストレージ
class SessionStorage {
  private static STORAGE_KEY = 'dapp:wallet_session'
  private static TTL = 7 * 24 * 60 * 60 * 1000 // 7 日間で期限切れ

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

      // 期限切れチェック
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

## 自動再接続戦略：ページリフレッシュ後の接続復元

ページリフレッシュ後、フロントエンドは自動的に前回のセッション復元を試みるべきです。再接続戦略は複数の失敗シナリオを処理する必要があります：

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

    // WalletConnect はセッション復元が必要
    if (savedSession.walletType === 'walletconnect') {
      return this.reconnectWalletConnect(savedSession)
    }

    // Injected ウォレット（MetaMask など）は silent connect を試行
    return this.reconnectInjected(provider, savedSession)
  }

  private async reconnectInjected(
    provider: EIP1193Provider,
    savedSession: WalletSession,
  ): Promise<WalletSession | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // アカウント認可をリクエスト（サイレントモード、ポップアップなし）
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        }) as string[]

        // アドレスが一致するか検証
        if (accounts[0]?.toLowerCase() !== savedSession.address.toLowerCase()) {
          // アドレスが変わった、再接続が必要
          SessionStorage.clear()
          return null
        }

        // チェーン ID を検証
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
          // ユーザーが接続を拒否
          SessionStorage.clear()
          return null
        }

        // その他のエラー、遅延リトライ
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
    // WalletConnect の再接続はその SDK が処理
    // セッションがまだアクティブかチェック
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
    // WalletConnect クライアントインスタンスを返す
    return null
  }
}
```

## ネットワーク切り替え検出と状態同期

ユーザーはいつでもウォレット内でネットワークを切り替えられる可能性があります。フロントエンドは `chainChanged` イベントを監視し状態を同期しなければなりません：

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
    // チェーン切り替え
    this.provider.on('chainChanged', (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      this.handleChainChange(newChainId)
    })

    // アカウント切り替え
    this.provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        // ユーザーが接続を切断
        this.handleDisconnect()
      } else {
        this.handleAccountChange(accounts[0] as Address)
      }
    })

    // 切断（EIP-1193）
    this.provider.on('disconnect', (error: { code: number; message: string }) => {
      this.handleDisconnect()
    })
  }

  private handleChainChange(newChainId: number) {
    if (newChainId === this.currentChainId) return

    this.currentChainId = newChainId

    // セッションを更新
    SessionStorage.update((s) => ({ ...s, chainId: newChainId }))

    // サポート対象かチェック
    const supported = this.supportedChains.has(newChainId)

    // すべてのリスナーに通知
    this.listeners.forEach((listener) => listener(newChainId))

    if (!supported) {
      // ユーザーにサポート対象チェーンへの切り替えを促す
      this.promptSwitchNetwork()
    }
  }

  private handleAccountChange(newAddress: Address) {
    SessionStorage.update((s) => ({
      ...s,
      address: newAddress,
      lastActiveAt: Date.now(),
    }))

    // 新しいアドレスに関連しないキャッシュデータをクリア
    this.clearUserSpecificCache()
  }

  private handleDisconnect() {
    SessionStorage.clear()
    this.listeners.forEach((listener) => listener(0)) // 0 は切断を示す
  }

  // 指定チェーンへの切り替えをリクエスト
  async requestSwitchChain(targetChainId: number): Promise<boolean> {
    const chainIdHex = `0x${targetChainId.toString(16)}`

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return true
    } catch (error: any) {
      // チェーンが未追加、追加を試行
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
    // ネットワーク不一致の UI プロンプトを表示
  }

  private clearUserSpecificCache() {
    // ユーザー関連のキャッシュをクリア
  }
}
```

## マルチウォレット同時接続管理

ユーザーは複数のウォレットを同時に接続する可能性があります。DApp は複数の provider を管理し、アクティブウォレットを選択する必要があります：

```typescript
class MultiWalletManager {
  private wallets: Map<WalletType, {
    provider: EIP1193Provider
    address: Address
    chainId: number
    isActive: boolean
  }> = new Map()
  private activeWallet: WalletType | null = null

  // ウォレットを接続
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

    // アクティブウォレットがない場合、現在のウォレットに設定
    if (!this.activeWallet) {
      this.activeWallet = walletType
    }

    // セッションを保存
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

  // アクティブウォレットを切り替え
  setActiveWallet(walletType: WalletType): void {
    if (!this.wallets.has(walletType)) {
      throw new Error(`Wallet ${walletType} not connected`)
    }

    // 他のウォレットのアクティブ状態を解除
    for (const [type, wallet] of this.wallets) {
      wallet.isActive = type === walletType
    }

    this.activeWallet = walletType

    // セッションを更新
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

  // アクティブウォレットを取得
  getActiveWallet() {
    if (!this.activeWallet) return null
    return this.wallets.get(this.activeWallet)!
  }

  // 指定ウォレットを切断
  async disconnect(walletType?: WalletType): Promise<void> {
    const type = walletType || this.activeWallet
    if (!type) return

    const wallet = this.wallets.get(type)
    if (!wallet) return

    // リスナーをクリーンアップ
    wallet.provider.removeAllListeners?.()

    this.wallets.delete(type)

    if (this.activeWallet === type) {
      // 他の接続済みウォレットに切り替え
      const remaining = Array.from(this.wallets.keys())
      if (remaining.length > 0) {
        this.setActiveWallet(remaining[0])
      } else {
        this.activeWallet = null
        SessionStorage.clear()
      }
    }
  }

  // 接続済みウォレットをすべてリスト
  listConnected(): { type: WalletType; address: Address; chainId: number }[] {
    return Array.from(this.wallets.entries()).map(([type, wallet]) => ({
      type,
      address: wallet.address,
      chainId: wallet.chainId,
    }))
  }
}
```

## セッション期限切れと安全な切断

安全な切断は単に状態をクリアするだけではありません——ウォレットへの通知、イベントリスナーのクリーンアップ、認可の取り消しも必要です：

```typescript
class SessionManager {
  private networkManager: NetworkManager | null = null
  private multiWallet: MultiWalletManager
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(multiWallet: MultiWalletManager) {
    this.multiWallet = multiWallet
  }

  // セッションハートビートを開始
  startHeartbeat(intervalMs: number = 60000) {
    this.heartbeatInterval = setInterval(() => {
      const session = SessionStorage.load()
      if (!session) {
        this.terminate()
        return
      }

      // 最終アクティブ時間を更新
      SessionStorage.update((s) => ({
        ...s,
        lastActiveAt: Date.now(),
      }))
    }, intervalMs)
  }

  // 安全に切断
  async terminate(): Promise<void> {
    // 1. ハートビートを停止
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 2. すべてのウォレットを切断
    await this.multiWallet.disconnect()

    // 3. セッションストレージをクリア
    SessionStorage.clear()

    // 4. ネットワークリスナーをクリーンアップ
    this.networkManager?.destroy()

    // 5. ユーザー関連キャッシュをクリア
    this.clearUserCache()

    // 6. 状態をリセット
    this.networkManager = null
  }

  private clearUserCache() {
    // SWR/React Query キャッシュをクリア
    // localStorage のユーザー設定をクリア
    // sessionStorage をクリア
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

## 完全なウォレットセッションマネージャー

上記のコンポーネントを統一されたセッションマネージャーに統合します：

```typescript
class WalletSessionManager {
  private multiWallet: MultiWalletManager
  private reconnector: WalletReconnector
  private networkManager: NetworkManager | null = null
  private sessionManager: SessionManager
  private state: SessionState = { status: 'disconnected' }

  // 状態型
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

  // 初期化：自動再接続を試行
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

  // ウォレットを接続
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

  // 切断
  async disconnect(): Promise<void> {
    await this.sessionManager.terminate()
    this.setState({ status: 'disconnected' })
  }

  // アクティブウォレットを切り替え
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

  // 状態購読
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
    // 対応する provider を返す
    throw new Error('Not implemented')
  }

  private getSupportedChains(): number[] {
    return [1, 10, 137, 42161, 8453]
  }
}
```

## エラーリカバリー：接続断絶、RPC タイムアウト

ネットワークが不安定な場合やウォレット拡張機能がクラッシュした場合、フロントエンドはグレースフルに回復する必要があります：

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

## モバイル DApp ブラウザのセッション特殊性

モバイル DApp ブラウザ（MetaMask App、TokenPocket など）のセッション管理はデスクトップと大きく異なります：

- **拡張機能の注入なし**：provider は `window.ethereum` ではなく WebView 経由で注入される
- **セッションライフサイクルが短い**：App がバックグラウンドに移ると WebView が回収される可能性がある
- **WalletConnect パス**：ディープリンク経由でウォレット App にジャンプ
- **ネットワーク切り替え制限**：一部のモバイルウォレットは `wallet_switchEthereumChain` をサポートしていない

```typescript
// モバイル検出と対応
class MobileAdapter {
  static isMobile(): boolean {
    return /Android|iPhone|iPad/i.test(navigator.userAgent)
  }

  static isDAppBrowser(): boolean {
    // ウォレット App の DApp ブラウザ内かどうかを検出
    return typeof (window as any).ethereum !== 'undefined' &&
           (window as any).ethereum.isMetaMask &&
           this.isMobile()
  }

  static isWalletConnectNeeded(): boolean {
    // モバイルブラウザ（DApp ブラウザ以外）は WalletConnect が必要
    return this.isMobile() && !this.isDAppBrowser()
  }

  // モバイルセッション管理の特別処理
  static getSessionConfig() {
    if (this.isDAppBrowser()) {
      return {
        // DApp ブラウザ内：セッションは WebView のライフサイクルに従う
        storage: 'sessionStorage' as const,
        heartbeatInterval: 15000, // より頻繁なハートビート
        reconnectOnVisible: true,  // App がフォアグラウンドに戻ったときに再接続
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

  // App 可視性監視（モバイル特有）
  static onAppVisible(callback: () => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        callback()
      }
    })
  }
}
```

## ベストプラクティス：統一された接続状態管理

1. **単一データソース**：すべてのコンポーネントが同じ SessionManager から状態を取得し、複数コンポーネントでの個別接続管理を避ける
2. **楽観的更新**：ユーザーが接続をクリックしたら即座に接続中状態を表示し、RPC 応答を待たない
3. **グレースフルデグラデーション**：ウォレットが利用不可の場合は WalletConnect フォールバックを提供
4. **セッション期限切れ通知**：セッションがまもなく期限切れになる場合に更新を促す
5. **マルチチェーン感知**：ネットワーク切り替え時に自動的に旧チェーンのデータキャッシュをクリア
6. **モバイル対応**：実行環境を検出し、セッション戦略を調整

## まとめ

ウォレットセッション管理は DApp フロントエンドのインフラストラクチャです。堅牢なセッションシステムは、接続、再接続、ネットワーク切り替え、マルチウォレット同時接続、安全な切断といった各段階で正しい処理を行う必要があります。localStorage 永続化 + 自動再接続はユーザー体験を復元する鍵です。ネットワーク切り替え検出と状態同期はデータ不整合を回避する保証です。モバイル DApp ブラウザの特殊性には対応戦略が必要です。すべてのロジックを統一された SessionManager にカプセル化し、購読パターンで状態を公開することが現在のベストプラクティスです。EIP-6963（マルチ注入ウォレット発見）の普及に伴い、マルチウォレット同時接続管理が標準となり、フロントエンドのセッションアーキテクチャはこれに備えるべきです。
