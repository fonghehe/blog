---
title: "Web3 Providerアーキテクチャ：Infuraから独自ノード構築まで"
date: 2019-09-15 19:44:34
tags:
  - Web3
  - Ethereum
---

ProviderはDAppフロントエンドとEthereumブロックチェーンが通信するための抽象レイヤーです。低レベルのJSON-RPCプロトコルの詳細を隠蔽し、上位層に統一されたAPIインターフェースを提供します。しかし実際の開発では、Providerの選択と管理は「一つ選んで使う」よりもはるかに複雑です——異なるProviderタイプはリアルタイム性、安定性、コストにおいて全く異なる特性を持ちます。本番レベルのDAppはProviderの降格、ロードバランシング、接続回復などの一連のインフラ問題を処理する必要があり、これらの問題は従来のWeb開発では通常HTTPクライアントライブラリやCDNによって解決されますが、Web3分野では依然としてデベロッパーが手動で処理する必要があります。

## Provider抽象レイヤーの設計哲学

web3.jsとethers.jsはどちらもProvider抽象レイヤーを通じてアプリケーションロジックと低レベル通信を分離しています：

```
DAppアプリケーション層
    ↓
web3.js / ethers.js
    ↓
Provider（抽象レイヤー）
    ↓
┌──────────┬──────────────┬──────────────┐
│  HTTP    │  WebSocket   │    IPC       │
│ Provider │   Provider   │   Provider   │
└──────────┴──────────────┴──────────────┘
    ↓            ↓              ↓
Ethereumノード  Ethereumノード   Ethereumノード
(Infura/        (Infura/         (ローカルGeth/
 独自構築)       独自構築)         Parity)
```

Providerのコアの責務：

1. **JSON-RPCリクエストの送信**：web3.jsのメソッド呼び出しを`eth_call`、`eth_sendTransaction`などのRPCリクエストに変換
2. **接続ライフサイクルの管理**：確立、維持、再接続、降格
3. **サブスクリプションの処理**：イベントサブスクリプションを`eth_subscribe`に変換しコールバックを管理
4. **エンコード/デコード**：リクエストパラメータのエンコードとレスポンス結果のデコードを処理

Providerの本質を理解することはJSON-RPCを理解することです——Providerの上がアプリケーションロジック、Providerの下がネットワークプロトコルです。

## HTTP Provider：シンプルだがリアルタイムリスニング不可

```javascript
const Web3 = require('web3');

// Infura HTTPエンドポイントに接続
const web3 = new Web3(new Web3.providers.HttpProvider(
    'https://mainnet.infura.io/v3/YOUR_API_KEY'
));

// すべての操作が独立したHTTPリクエスト
web3.eth.getBlockNumber().then(console.log);       // GETリクエスト
web3.eth.getBalance(address).then(console.log);     // 別のGETリクエスト
```

HTTP Providerの動作方式はシンプルかつ直接的です：毎回のweb3.js呼び出しが独立したHTTP POSTリクエストで、結果を返した後に接続が閉じられます。このモードの長所と短所は非常に明確です：

**長所：**
- 実装がシンプルで、互換性が最も高い
- ステートレスで、接続を維持する必要がない
- HTTPインフラ（CDN、ロードバランシング）によって最適化済み

**短所：**
- `eth_subscribe`サブスクリプションが実現不可——HTTPはリクエスト-レスポンスモードで、サーバーから能動的にプッシュできない
- ポーリングでしかリアルタイムリスニングを模擬できず、レイテンシが高くリソースを無駄にする
- 毎回のリクエストにTCP/TLSハンドシェイクのオーバーヘッドがある（keep-aliveで緩和可能）

```javascript
// HTTP Providerはイベントをサブスクライブできず、ポーリングするしかない
async function pollNewBlocks(web3, callback, interval = 15000) {
    let lastBlock = await web3.eth.getBlockNumber();

    setInterval(async () => {
        const currentBlock = await web3.eth.getBlockNumber();
        if (currentBlock > lastBlock) {
            for (let i = lastBlock + 1; i <= currentBlock; i++) {
                const block = await web3.eth.getBlock(i, true);
                callback(block);
            }
            lastBlock = currentBlock;
        }
    }, interval);
}
```

## WebSocket Provider：リアルタイムイベントだが接続が不安定

```javascript
const web3 = new Web3(new Web3.providers.WebsocketProvider(
    'wss://mainnet.infura.io/ws/v3/YOUR_API_KEY'
));

// 新しいブロックをサブスクライブ
web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (!error) {
        console.log('New block:', blockHeader.number);
    }
});

// コントラクトイベントをサブスクライブ
contract.events.Transfer({})
    .on('data', (event) => {
        console.log('Transfer event:', event);
    });
```

WebSocket Providerは永続接続を維持し、サーバー側が新しいブロックやイベントがある際に能動的にデータをプッシュできます。これはリアルタイム性の問題を解決しましたが、新たな課題を導入しました：

**長所：**
- リアルタイムイベントプッシュ（`eth_subscribe`）
- 低レイテンシ、ポーリング不要
- 接続再利用、ハンドシェイクオーバーヘッドを削減

**短所：**
- 接続が不安定で切断されやすい（ネットワークの変動、サーバータイムアウト、プロキシサーバーの制限）
- 再接続ロジックの実装が必要
- InfuraのWebSocketエンドポイントには接続数制限とアイドルタイムアウトがある

```javascript
// 再接続機能付きWebSocket Provider
class ResilientWebSocketProvider {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: options.reconnectInterval || 1000,
            maxReconnectInterval: options.maxReconnectInterval || 30000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            ...options
        };
        this.reconnectAttempts = 0;
        this.subscriptions = [];
        this.provider = null;
        this.web3 = null;
        this.connected = false;
    }

    connect() {
        this.provider = new Web3.providers.WebsocketProvider(this.url, {
            reconnect: {
                auto: true,
                delay: this.options.reconnectInterval,
                maxDelay: this.options.maxReconnectInterval,
                onTimeout: false
            }
        });

        this.web3 = new Web3(this.provider);

        this.provider.on('connect', () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.resubscribe();
        });

        this.provider.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.connected = false;
        });

        this.provider.on('end', () => {
            console.log('WebSocket disconnected');
            this.connected = false;
            this.handleDisconnect();
        });
    }

    handleDisconnect() {
        this.reconnectAttempts++;
        if (this.reconnectAttempts > this.options.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.onFatalError(new Error('Max reconnection attempts reached'));
            return;
        }

        const delay = Math.min(
            this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts),
            this.options.maxReconnectInterval
        );

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect(), delay);
    }

    resubscribe() {
        this.subscriptions.forEach(sub => {
            if (sub.type === 'newBlockHeaders') {
                this.web3.eth.subscribe('newBlockHeaders', sub.callback);
            } else if (sub.type === 'logs') {
                this.web3.eth.subscribe('logs', sub.options, sub.callback);
            }
        });
    }

    subscribeNewBlocks(callback) {
        this.subscriptions.push({ type: 'newBlockHeaders', callback });
        if (this.connected) {
            this.web3.eth.subscribe('newBlockHeaders', callback);
        }
    }

    subscribeLogs(options, callback) {
        this.subscriptions.push({ type: 'logs', options, callback });
        if (this.connected) {
            this.web3.eth.subscribe('logs', options, callback);
        }
    }

    onFatalError(error) {
        // HTTP Providerへの降格をトリガー
        console.error('Fatal error, falling back to HTTP:', error);
    }
}
```

## IPC Provider：ローカルノードの最適な選択

```javascript
const net = require('net');
const Web3 = require('web3');

// IPC ProviderはNode.js環境でのみ利用可能
const web3 = new Web3(new Web3.providers.IpcProvider(
    '/Users/fong/.ethereum/geth.ipc',
    net
));
```

IPC（Inter-Process Communication）ProviderはUnix Domain Socketを通じて通信し、ローカルEthereumノードに接続する最適な選択です：

**長所：**
- 最高のパフォーマンス（ネットワーク/TCP/TLSのオーバーヘッドなし）
- 高いセキュリティ（ローカル通信、ネットワークを経由しない）
- 高い安定性（ネットワークの変動がない）
- 接続数制限なし

**短所：**
- Node.js環境のみ、ブラウザでは使用不可
- ローカルEthereumノードの実行が必要
- ノードのIPC有効化が必要（`--ipcpath`またはデフォルトパス）

IPC Providerは主にバックエンドサービス（インデックスサービス、トランザクションプロセッサー、自動テストなど）に使用され、DAppフロントエンドには適していません。

## Infura APIの使用と制限

Infuraは最も人気のあるEthereumノードサービスプロバイダーで、DAppに独自ノード構築不要のJSON-RPCアクセス能力を提供します。

### 基本的な使用

```javascript
// HTTP
const web3 = new Web3('https://mainnet.infura.io/v3/YOUR_PROJECT_ID');

// WebSocket
const web3ws = new Web3('wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID');

// 異なるネットワーク
const ropstenWeb3 = new Web3('https://ropsten.infura.io/v3/YOUR_PROJECT_ID');
const rinkebyWeb3 = new Web3('https://rinkeby.infura.io/v3/YOUR_PROJECT_ID');
```

### Infuraの制限

1. **リクエスト頻度制限**：無料版は1日100,000リクエスト、有料版はそれ以上
2. **WebSocket接続制限**：同時接続数に制限があり、アイドル接続は閉じられる
3. **`eth_getLogs`の範囲制限**：単一クエリで10,000ブロック以下（Mainnet）または5,000ブロック以下（テストネット）
4. **一部のRPCメソッドをサポートしない**：`personal_*`、`admin_*`、`miner_*`などのノード管理メソッドは不可
5. **pendingトランザクションプールなし**：mempoolの未確認トランザクションを取得できない

```javascript
// Infuraのリクエスト制限の処理
class RateLimitedProvider {
    constructor(url, maxRequestsPerSecond = 10) {
        this.web3 = new Web3(url);
        this.queue = [];
        this.processing = false;
        this.interval = 1000 / maxRequestsPerSecond;
    }

    async call(method, ...args) {
        return new Promise((resolve, reject) => {
            this.queue.push({ method, args, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const { method, args, resolve, reject } = this.queue.shift();
            try {
                const result = await this.web3.eth[method](...args);
                resolve(result);
            } catch (error) {
                if (error.message.includes('rate limit') || error.message.includes('429')) {
                    // レート制限、待機後にリトライ
                    this.queue.unshift({ method, args, resolve, reject });
                    await this.sleep(1000);
                } else {
                    reject(error);
                }
            }
            await this.sleep(this.interval);
        }

        this.processing = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

## 独自Ethereumノード構築の考慮事項

### Geth vs Erigon

独自ノードを構築する主流の選択肢はGeth（Go-Ethereum）です。Erigon（旧名Turbo-Geth）はより高効率な実装として注目を集めています：

| 特性 | Geth | Erigon (Turbo-Geth) |
|------|------|---------------------|
| 言語 | Go | Go |
| 同期モード | Fast / Full / Light | Archive / Full |
| ディスク使用量 | ~400GB (Full) | ~200GB (Full) |
| 同期速度 | 中程度 | より速い |
| 安定性 | 成熟して安定 | 実験的 |
| RPC互換性 | 完全 | 高度に互換 |

### Gethノードの設定

```bash
# Gethノードを起動
geth \
    --datadir /path/to/data \
    --syncmode fast \
    --cache 4096 \
    --rpc \
    --rpcaddr 0.0.0.0 \
    --rpcport 8545 \
    --rpcapi eth,net,web3,txpool \
    --ws \
    --wsaddr 0.0.0.0 \
    --wsport 8546 \
    --wsorigins "*" \
    --ipcpath /path/to/geth.ipc \
    --maxpeers 50
```

### 独自ノードのコスト

1. **ハードウェアコスト**：SSDストレージ（最低1TB）、十分なメモリ（8GB+）、安定したネットワーク
2. **同期時間**：ジェネシスブロックから最新ブロックまでの同期に数日（Fastモード）から数週間（Fullモード）
3. **メンテナンスコスト**：バージョンアップグレード、ディスク監視、セキュリティ設定
4. **運用複雑さ**：ノードクラッシュ、ディスクフル、同期の遅れなどの問題にタイムリーに対応が必要

```javascript
// ノードの同期状態を監視
class NodeMonitor {
    constructor(web3) {
        this.web3 = web3;
        this.lastSyncBlock = 0;
        this.syncStallCount = 0;
    }

    async checkSync() {
        const syncing = await this.web3.eth.isSyncing();

        if (syncing) {
            const currentBlock = syncing.currentBlock;
            const highestBlock = syncing.highestBlock;
            const progress = (currentBlock / highestBlock * 100).toFixed(2);

            console.log(`Syncing: ${progress}% (${currentBlock}/${highestBlock})`);

            if (currentBlock === this.lastSyncBlock) {
                this.syncStallCount++;
                if (this.syncStallCount > 10) {
                    console.error('Sync stalled!');
                    this.onSyncStall();
                }
            } else {
                this.syncStallCount = 0;
                this.lastSyncBlock = currentBlock;
            }
        } else {
            console.log('Node is fully synced');
        }
    }

    onSyncStall() {
        // アラートまたはノードの自動再起動
    }

    start() {
        setInterval(() => this.checkSync(), 30000);
    }
}
```

## Provider降格戦略：WS -> HTTP -> バックアップノード

本番レベルのDAppは単一のProviderに依存すべきではありません。堅牢なProviderマネージャーは自動降格とフェイルオーバーをサポートすべきです：

```javascript
// provider-manager.js —— 自動降格をサポートするProviderマネージャー

const Web3 = require('web3');

class ProviderManager {
    constructor(config) {
        this.config = config;
        this.providers = [];
        this.currentIndex = 0;
        this.web3 = null;
        this.providerType = null;  // 'ws' | 'http'
        this.listeners = [];
    }

    init() {
        // Provider優先度リストを構築
        // 優先度：WebSocketメインノード -> WebSocketバックアップノード -> HTTPメインノード -> HTTPバックアップノード
        if (this.config.websocket) {
            this.config.websocket.forEach(url => {
                this.providers.push({
                    url: url,
                    type: 'ws',
                    provider: new Web3.providers.WebsocketProvider(url, {
                        reconnect: { auto: true, delay: 1000, maxDelay: 30000 }
                    }),
                    failures: 0,
                    maxFailures: 3
                });
            });
        }

        if (this.config.http) {
            this.config.http.forEach(url => {
                this.providers.push({
                    url: url,
                    type: 'http',
                    provider: new Web3.providers.HttpProvider(url, {
                        timeout: 10000,
                        keepAlive: true
                    }),
                    failures: 0,
                    maxFailures: 5
                });
            });
        }

        this.connect();
    }

    connect() {
        if (this.currentIndex >= this.providers.length) {
            console.error('All providers exhausted, retrying from beginning...');
            this.currentIndex = 0;
            this.providers.forEach(p => p.failures = 0);
        }

        const current = this.providers[this.currentIndex];
        console.log(`Connecting to provider ${this.currentIndex}: ${current.url} (${current.type})`);

        this.web3 = new Web3(current.provider);
        this.providerType = current.type;

        if (current.type === 'ws') {
            this.setupWebSocketHandlers(current);
        }

        this.testConnection(current);
    }

    setupWebSocketHandlers(providerInfo) {
        providerInfo.provider.on('connect', () => {
            console.log('WebSocket connected:', providerInfo.url);
            providerInfo.failures = 0;
            this.notifyListeners('connected', { type: 'ws', url: providerInfo.url });
        });

        providerInfo.provider.on('error', (error) => {
            console.error('WebSocket error:', providerInfo.url, error);
        });

        providerInfo.provider.on('end', () => {
            console.warn('WebSocket ended:', providerInfo.url);
            this.handleProviderFailure(providerInfo);
        });
    }

    async testConnection(providerInfo) {
        try {
            const blockNumber = await this.web3.eth.getBlockNumber();
            console.log(`Connection verified. Current block: ${blockNumber}`);
            providerInfo.failures = 0;
            this.notifyListeners('connected', {
                type: providerInfo.type,
                url: providerInfo.url,
                blockNumber
            });
        } catch (error) {
            console.error('Connection test failed:', error.message);
            this.handleProviderFailure(providerInfo);
        }
    }

    handleProviderFailure(providerInfo) {
        providerInfo.failures++;
        console.warn(`Provider failure ${providerInfo.failures}/${providerInfo.maxFailures}: ${providerInfo.url}`);

        if (providerInfo.failures >= providerInfo.maxFailures) {
            console.error('Provider exceeded max failures, switching...');
            this.switchProvider();
        }
    }

    switchProvider() {
        this.currentIndex++;
        if (this.currentIndex >= this.providers.length) {
            console.error('All providers failed, waiting before retry...');
            this.currentIndex = 0;
            setTimeout(() => this.connect(), 5000);
        } else {
            this.connect();
        }
    }

    notifyListeners(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }

    onStatusChange(callback) {
        this.listeners.push(callback);
    }

    getWeb3() {
        return this.web3;
    }

    getProviderType() {
        return this.providerType;
    }

    isRealtime() {
        return this.providerType === 'ws';
    }
}

// 使用例
const providerManager = new ProviderManager({
    websocket: [
        'wss://mainnet.infura.io/ws/v3/PROJECT_ID_1',
        'wss://mainnet.infura.io/ws/v3/PROJECT_ID_2'
    ],
    http: [
        'https://mainnet.infura.io/v3/PROJECT_ID_1',
        'https://mainnet.infura.io/v3/PROJECT_ID_2',
        'https://cloudflare-eth.com'
    ]
});

providerManager.init();

providerManager.onStatusChange((event, data) => {
    if (event === 'connected') {
        console.log(`Connected via ${data.type}: ${data.url}`);
    }
});
```

## ロードバランシングとリクエスト分散

DAppに大量のユーザーが同時にアクセスする場合、単一のProviderがボトルネックになる可能性があります。ロードバランシングによってリクエストを複数のProviderに分散できます：

```javascript
class LoadBalancedProvider {
    constructor(urls) {
        this.providers = urls.map(url => ({
            url: url,
            web3: new Web3(new Web3.providers.HttpProvider(url, {
                timeout: 10000,
                keepAlive: true
            })),
            healthy: true,
            latency: 0,
            requestCount: 0
        }));
        this.currentProvider = 0;
        this.healthCheckInterval = 60000;  // 1分のヘルスチェック
        this.startHealthCheck();
    }

    // ラウンドロビン戦略
    getProviderRoundRobin() {
        const healthyProviders = this.providers.filter(p => p.healthy);
        if (healthyProviders.length === 0) {
            throw new Error('No healthy providers available');
        }
        const provider = healthyProviders[this.currentProvider % healthyProviders.length];
        this.currentProvider++;
        return provider;
    }

    // 最小接続数戦略
    getProviderLeastConnections() {
        const healthyProviders = this.providers.filter(p => p.healthy);
        return healthyProviders.reduce((min, current) =>
            current.requestCount < min.requestCount ? current : min
        );
    }

    // 最小レイテンシ戦略
    getProviderLowestLatency() {
        const healthyProviders = this.providers.filter(p => p.healthy);
        return healthyProviders.reduce((min, current) =>
            current.latency < min.latency ? current : min
        );
    }

    async send(method, ...args) {
        const provider = this.getProviderRoundRobin();
        provider.requestCount++;

        const startTime = Date.now();
        try {
            const result = await provider.web3.eth[method](...args);
            provider.latency = Date.now() - startTime;
            provider.requestCount--;
            return result;
        } catch (error) {
            provider.requestCount--;
            provider.latency = 999999;  // 高レイテンシをマーク
            if (this.isConnectionError(error)) {
                provider.healthy = false;
                console.warn(`Provider ${provider.url} marked unhealthy`);
                // 次のproviderにリトライ
                return this.send(method, ...args);
            }
            throw error;
        }
    }

    isConnectionError(error) {
        return error.message.includes('CONNECTION ERROR') ||
               error.message.includes('Invalid JSON RPC response') ||
               error.code === 'ECONNREFUSED' ||
               error.code === 'ETIMEDOUT';
    }

    async startHealthCheck() {
        setInterval(async () => {
            for (const provider of this.providers) {
                if (!provider.healthy) {
                    try {
                        const start = Date.now();
                        await provider.web3.eth.getBlockNumber();
                        provider.latency = Date.now() - start;
                        provider.healthy = true;
                        console.log(`Provider ${provider.url} recovered`);
                    } catch (error) {
                        // まだ不健康
                    }
                } else {
                    try {
                        const start = Date.now();
                        await provider.web3.eth.getBlockNumber();
                        provider.latency = Date.now() - start;
                    } catch (error) {
                        provider.healthy = false;
                        console.warn(`Provider ${provider.url} went unhealthy`);
                    }
                }
            }
        }, this.healthCheckInterval);
    }

    getStats() {
        return this.providers.map(p => ({
            url: p.url,
            healthy: p.healthy,
            latency: p.latency,
            activeRequests: p.requestCount
        }));
    }
}
```

## ノードインフラの現状

Ethereumノードインフラは明確な二極分化を呈しています：

**一極はInfuraの寡占的地位。** 圧倒的多数のDAppがInfuraを唯一または主要なRPCエンドポイントとして依存していました。この中央集権化はEthereumの非中央集権理念と皮肉な対比をなしていました——Infuraがダウンすれば、大量のDAppが同時に利用不可能になります。Infuraは過去にAWSのインシデントにより数時間サービスが中断し、数百のDAppの可用性に直接影響を与えたことがあります。

**もう一極は独自ノード構築の高いハードル。** Ethereumのフルノードの同期には数日かかり、ディスク使用量は継続的に増加し（フルノードで約400GB+）、運用には専門スキルが必要です。大多数のDAppチームにとって、独自ノード構築のROIは極めて低いです——Infuraの無料枠で十分であり、独自ノードの運用コストはInfuraの有料プランを遥かに超えます。

この状況が「マルチProvider降格戦略」をDAppインフラの標準装備たらしめました——エレガントだからではなく、必要だからです。CloudflareのEthereumゲートウェイ、AlchemyなどのサービスがInfuraの代替手段を提供し始めましたが、市場構造は根本的には変わりません。

技術進化の観点から、Provider層の標準化はゆっくりと進んでいます。EIP-1193（Ethereum Provider API）とEIP-1102（Provider認可）は異なるウォレットとサービスのProviderインターフェースの統一を試みましたが、採用速度は予想より遅いです。ethers.jsはProvider設計においてweb3.jsよりクリアです（FallbackProvider、AlchemyProviderなどの組み込み実装など）。これもethers.jsがweb3.jsを徐々に置き換えていく理由の一つです。

DAppデベロッパーへの現実的なアドバイス：

1. **単一のProviderに依存しない**——Infuraを使用する場合でも、バックアップエンドポイントを設定すべき
2. **WebSocket優先、HTTPフォールバック**——リアルタイム性の要件はWSで満たし、安定性はHTTPで保証
3. **ヘルスチェックと自動切り替えを実装**——ユーザーがProviderの切り替えを感じないようにすべき
4. **Providerのレイテンシとエラー率を監視**——これはDApp可用性のコア指標

## まとめ

ProviderアーキテクチャはDAppインフラの中で見落とされがちだが極めて重要な部分です。アプリケーション層とブロックチェーンプロトコル層の間に位置し、その安定性とパフォーマンスがDAppのユーザー体験に直接影響します。

Providerエコシステムのコアの矛盾は「非中央集権の理想 vs 中央集権の現実」にあります。Ethereumの設計は各ユーザーが自身のノードを運用することを前提としていました——しかし実際には、99%のDAppユーザーがInfuraを通じてブロックチェーンにアクセスしています。この中央集権化は単一障害点のリスクを導入し、Provider降格戦略はこのリスクに対するエンジニアリングの補償です。

Providerの低レベルのメカニズム——JSON-RPC、HTTP vs WebSocketの特性の違い、接続管理の複雑さ——を理解することは、本番レベルのDAppを構築するための必須知識です。これらの知識はInfuraやAlchemyのサービスアップグレードによって失効することはありません。なぜならそれらはネットワークプロトコルレベルの基本的な制約に関わるものであり、特定のサービスのAPIではないからです。

Ethereum 2.0とLayer 2ソリューションの発展に伴い、Providerアーキテクチャはさらに複雑になります——L1とL2のリクエストの同時処理、クロスチェーン状態同期、異なるL2のProviderの差異への対応が必要です。しかしコアの原則は不変です：マルチソース冗長、自動降格、ヘルスチェック。これらの原則を習得してこそ、進化し続けるWeb3インフラにおいて信頼性の高いDAppを構築できます。
