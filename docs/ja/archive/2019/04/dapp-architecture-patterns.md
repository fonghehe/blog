---
title: "DAppアーキテクチャパターン：非中央集権アプリケーションの設計アプローチ"
date: 2019-04-12 17:38:01
tags:
  - Web3
  - DApp
  - アーキテクチャ
readingTime: 17
wordCount: 3382
description: "従来のWebアプリケーションのアーキテクチャはすでに成熟したパターンを形成しています——フロントエンド/バックエンド分離、RESTful API、データベース読み書き分離、CDN高速化、マイクロサービス分割。しかしアプリケーションをブロックチェーン上で実行する必要がある場合、これらのパターンはほぼすべて見直しが必要です"
---

従来のWebアプリケーションのアーキテクチャはすでに成熟したパターンを形成しています——フロントエンド/バックエンド分離、RESTful API、データベース読み書き分離、CDN高速化、マイクロサービス分割。しかしアプリケーションをブロックチェーン上で実行する必要がある場合、これらのパターンはほぼすべて見直しが必要です。DAppには従来のバックエンドサーバーがなく、中央集権的なデータベースがなく、ユーザーはパスワードではなくウォレット署名でアイデンティティを認証します。この根本的な違いは、デベロッパーにゼロから新しいアーキテクチャ思考を構築することを要求します。

## DAppと従来Webアプリケーションのコアの違い

| 次元 | 従来Webアプリケーション | DApp |
|------|-------------|------|
| バックエンドロジック | サーバープロセス（Node.js/Java/Go） | スマートコントラクト（EVM上で実行） |
| データストレージ | データベース（MySQL/MongoDB） | オンチェーンstorage + オフチェーンIPFS |
| アイデンティティ認証 | ユーザー名＋パスワード / OAuth | ウォレットアドレス＋署名 |
| API呼び出し | HTTPリクエスト | JSON-RPC / コントラクト呼び出し |
| 書き込み操作 | データベースINSERT/UPDATE | トランザクションのオンチェーン（Gas消費） |
| 読み取り操作 | データベースSELECT | コントラクトcall / イベントログ |
| フロントエンドホスティング | CDN / サーバー | IPFS / 中央集権的サーバー |
| 可用性 | 99.99% SLA | ノードの可用性に依存 |
| パフォーマンス | ミリ秒レベルのレスポンス | 秒単位から分単位の確認 |

最も根本的な違いは**書き込み操作のコストとレイテンシ**です。従来アプリでのデータベース書き込みは数ミリ秒ですが、DAppでのコントラクト呼び出しはブロック確定を待つ必要があります（Ethereumで約15秒）。これはDAppが従来アプリのインタラクションモデルをそのまま流用できないことを直接決定づけています——ユーザーが毎回クリック後に15秒待つことは不可能です。

## 非中央集権アーキテクチャの階層

### コントラクト層

コントラクト層はDAppのビジネスロジックの中核で、EVM上で実行されます：

```solidity
// コントラクト層：コアビジネスロジック
contract Marketplace {
    struct Listing {
        uint256 id;
        address seller;
        uint256 price;
        string ipfsHash;    // 商品情報はIPFSに保存
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId;

    event Listed(uint256 indexed id, address indexed seller, uint256 price);
    event Purchased(uint256 indexed id, address buyer, uint256 price);

    function list(uint256 price, string ipfsHash) external {
        listings[nextListingId] = Listing({
            id: nextListingId,
            seller: msg.sender,
            price: price,
            ipfsHash: ipfsHash,
            active: true
        });

        emit Listed(nextListingId, msg.sender, price);
        nextListingId++;
    }

    function purchase(uint256 id) external payable {
        Listing storage listing = listings[id];
        require(listing.active, "Listing not active");
        require(msg.value == listing.price, "Incorrect price");

        listing.active = false;
        listing.seller.transfer(msg.value);

        emit Purchased(id, msg.sender, listing.price);
    }
}
```

コントラクト層の設計原則：

1. **オンチェーンロジックの最小化**：非中央集権化が必須のロジックのみをコントラクトに配置
2. **状態の簡素化**：オンチェーンストレージは高コスト、オフチェーンで解決できるものはオフチェーンで
3. **イベント駆動**：フロントエンドにポーリング読み取りさせるのではなく、eventで状態変化を公開

### データ層

データ層はオンチェーンとオフチェーンの2つに分かれます：

```
オンチェーンデータ（Storage）
├── コントラクト状態変数（残高、権限、リストID）
├── コントラクトコード（bytecode）
└── イベントログ（取引履歴）

オフチェーンデータ
├── IPFS（大きなファイル、metadata、商品詳細）
├── インデックスサービス（イベントインデックス、検索インデックス）
└── 従来データベース（キャッシュ、非重要データ）
```

データ階層化の意思決定フレームワーク：

| データタイプ | ストレージ位置 | 理由 |
|---------|---------|------|
| 残高、権限 | オンチェーンstorage | コンセンサスと改ざん不可が必要 |
| 取引履歴 | オンチェーンevent logs | 検証可能性が必要 |
| 商品画像 | IPFS | 大きなファイル、非中央集権が必要 |
| 商品説明 | IPFS + オンチェーンhash | 内容は固定、完全性検証が必要 |
| ユーザー設定 | オフチェーンデータベース | 非重要データ、コンセンサス不要 |
| 検索インデックス | オフチェーンインデックスサービス | 全文検索機能が必要 |

### フロントエンド層

フロントエンド層はユーザーとのインタラクションを担当し、DAppの中で最も「伝統的」な部分ですが、ブロックチェーン特有のロジックが追加されています：

```javascript
// DAppフロントエンドアーキテクチャ
class DAppFrontend {
    constructor() {
        this.web3 = null;          // Web3インスタンス
        this.account = null;        // 現在のアカウント
        this.contract = null;       // コントラクトインスタンス
        this.eventWatcher = null;   // イベントリスナー
        this.cache = new Map();     // ローカルキャッシュ
    }

    async init() {
        // 1. ウォレットに接続
        await this.connectWallet();

        // 2. コントラクトを初期化
        await this.initContract();

        // 3. 履歴状態を同期
        await this.syncHistory();

        // 4. イベントリスニングを開始
        this.startEventListening();

        // 5. 初期画面をレンダリング
        await this.render();
    }

    async connectWallet() {
        if (typeof window.ethereum !== 'undefined') {
            const accounts = await window.ethereum.enable();
            this.account = accounts[0];
            this.web3 = new Web3(window.ethereum);

            // アカウント切り替えをリスニング
            window.ethereum.on('accountsChanged', (accounts) => {
                this.account = accounts[0];
                this.render();
            });
        } else {
            throw new Error('Please install MetaMask');
        }
    }

    async initContract() {
        const networkId = await this.web3.eth.net.getId();
        const deployedAddress = CONTRACT_NETWORKS[networkId];

        if (!deployedAddress) {
            throw new Error(`Contract not deployed on network ${networkId}`);
        }

        this.contract = new this.web3.eth.Contract(CONTRACT_ABI, deployedAddress);
    }
}
```

## オンチェーンデータ vs オフチェーンデータの設計判断

これはDAppアーキテクチャにおける最も重要な意思決定です——どのデータをオンチェーンにし、どのデータをオフチェーンにするか。原則は：**トラストレスな場面でコンセンサスが必須のデータのみオンチェーンにする**です。

### オンチェーンにすべきかの判断基準

1. **改ざん不可が必要か？** データが一度書き込まれたら変更されるべきでない場合（所有権記録など）、オンチェーンに
2. **非中央集権的検証が必要か？** 複数の当事者が信頼できない環境で合意する必要がある場合（取引決済など）、オンチェーンに
3. **検閲耐性が必要か？** データがいかなる単一主体によって削除されてはならない場合（DAO投票記録など）、オンチェーンに
4. **Gasコストが許容範囲か？** ストレージコストがビジネス収益を超える場合、オフチェーンに

### ハイブリッドストレージパターン

```solidity
// ハイブリッドストレージ：オンチェーンにhash、オフチェーンにコンテンツ
contract DecentralizedBlog {
    struct Post {
        bytes32 contentHash;    // IPFS CIDのハッシュ
        address author;
        uint256 timestamp;
        uint256 tipAmount;
    }

    mapping(bytes32 => Post) public posts;  // postId => Post
    bytes32[] public postIds;

    event PostCreated(bytes32 indexed postId, address indexed author, bytes32 contentHash);

    function createPost(bytes32 contentHash) external returns (bytes32 postId) {
        postId = keccak256(abi.encodePacked(msg.sender, block.number, contentHash));

        posts[postId] = Post({
            contentHash: contentHash,
            author: msg.sender,
            timestamp: block.timestamp,
            tipAmount: 0
        });

        postIds.push(postId);
        emit PostCreated(postId, msg.sender, contentHash);
    }

    function tip(bytes32 postId) external payable {
        require(posts[postId].author != address(0), "Post not found");
        posts[postId].tipAmount += msg.value;
        posts[postId].author.transfer(msg.value);
    }
}
```

記事の内容はIPFSに保存され、オンチェーンにはコンテンツのハッシュのみ記録します。これによりコンテンツの改ざん不可能性（ハッシュ検証）を保ちつつ、ストレージコストを許容範囲に抑えられます。

## 非中央集権アイデンティティ認証：ウォレットアドレスがアイデンティティ

DAppのアイデンティティ認証モデルは従来のWebとは全く異なります——ユーザー名とパスワードがなく、sessionがなく、JWTがありません。ユーザーのアイデンティティはそのウォレットアドレスであり、認証方式は秘密鍵署名です。

### 署名認証フロー

```javascript
class AuthManager {
    constructor(web3) {
        this.web3 = web3;
        this.sessions = new Map();  // address -> session
    }

    // ランダムなnonceを生成してユーザーに署名してもらう
    async authenticate() {
        const accounts = await this.web3.eth.getAccounts();
        const address = accounts[0];

        // nonceを生成
        const nonce = Math.random().toString(36).substring(2);
        const message = `Sign this message to authenticate: ${nonce}`;

        // ユーザーに署名をリクエスト（トランザクションを送信せず、Gas消費なし）
        const signature = await this.web3.eth.personal.sign(message, address, '');

        // 署名を検証
        const recoveredAddress = this.web3.eth.accounts.recover(message, signature);

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            const session = {
                address: address,
                nonce: nonce,
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000  // 1時間有効
            };
            this.sessions.set(address, session);
            return session;
        }

        throw new Error('Signature verification failed');
    }

    isAuthenticated(address) {
        const session = this.sessions.get(address);
        return session && session.expiresAt > Date.now();
    }

    // オフチェーンサービスと連携する場合、署名をサーバーに送って検証可能
    async getAuthToken(address) {
        const session = this.sessions.get(address);
        if (!session) throw new Error('Not authenticated');

        // 署名とアドレスをオフチェーンサーバーに送信
        const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: session.address,
                signature: session.signature,
                message: session.message
            })
        });

        return (await response.json()).token;
    }
}
```

この認証方式の利点：

1. **パスワード不要**：ユーザーはもう一つのパスワードを覚える必要がない
2. **バックエンドアカウントデータベース不要**：アドレスが一意の識別子
3. **フィッシング防止**：署名メッセージはフロントエンドが生成し、ユーザーはMetaMaskで完全なメッセージを確認できる
4. **DApp間で共通**：同じウォレットアドレスをすべてのDAppで使用可能

欠点：

1. **復旧不可**：秘密鍵の紛失はアイデンティティの永久な喪失を意味する
2. **プライバシーが低い**：すべてのオンチェーン行動がアドレスに公開関連付けられる
3. **UXの障壁**：毎回の操作で署名が必要で、従来Webほどスムーズなユーザー体験ではない

## 状態同期パターン

### イベント駆動

```javascript
// イベント駆動：コントラクトイベントをリスニングし、リアルタイムでフロントエンド状態を更新
class EventDrivenSync {
    constructor(contract) {
        this.contract = contract;
        this.state = { items: [], balances: {} };
    }

    async init() {
        // 初期同期
        await this.syncHistory();

        // WebSocketリアルタイムリスニング
        this.contract.events.ItemListed({})
            .on('data', (event) => {
                this.state.items.push({
                    id: event.returnValues.itemId,
                    seller: event.returnValues.seller,
                    price: event.returnValues.price
                });
                this.notifyUpdate();
            });
    }

    async syncHistory() {
        const events = await this.contract.getPastEvents('ItemListed', {
            fromBlock: 0,
            toBlock: 'latest'
        });

        this.state.items = events.map(event => ({
            id: event.returnValues.itemId,
            seller: event.returnValues.seller,
            price: event.returnValues.price
        }));
    }

    notifyUpdate() {
        // UIの再レンダリングをトリガー
        window.dispatchEvent(new CustomEvent('stateUpdate', {
            detail: this.state
        }));
    }
}
```

### ポーリング

```javascript
// ポーリング：定期的にコントラクト状態をクエリ
class PollingSync {
    constructor(contract, interval = 10000) {
        this.contract = contract;
        this.interval = interval;
        this.timer = null;
    }

    start() {
        this.poll();
        this.timer = setInterval(() => this.poll(), this.interval);
    }

    async poll() {
        // オンチェーン状態を直接読み取り
        const itemCount = await this.contract.methods.itemCount().call();

        for (let i = 0; i < itemCount; i++) {
            const item = await this.contract.methods.items(i).call();
            // ローカル状態を更新
            this.updateItem(item);
        }
    }

    stop() {
        clearInterval(this.timer);
    }
}
```

### インデックスサービス

```javascript
// インデックスサービスを使用（The Graphなど）
class IndexedSync {
    constructor(graphQLEndpoint) {
        this.endpoint = graphQLEndpoint;
    }

    async getItems(filters = {}) {
        const query = `
            query GetItems($seller: Bytes) {
                items(where: { seller: $seller }, orderBy: price, orderDirection: asc) {
                    id
                    seller
                    price
                    active
                }
            }
        `;

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                variables: { seller: filters.seller }
            })
        });

        return (await response.json()).data.items;
    }
}
```

### 3つのモードの比較

| モード | リアルタイム性 | 実装の複雑さ | クエリ能力 | 非中央集権度 |
|------|--------|-----------|---------|-------------|
| イベント駆動 | 高い | 中 | 強い（indexedフィールドでしかフィルタできない） | 高い |
| ポーリング | 低い | 低い | 弱い | 高い |
| インデックスサービス | 中 | 低い（消費側） | 強い（GraphQL） | 低い（インデクサーに依存） |

## フロントエンドホスティングの非中央集権化：IPFS + ENS

DAppのフロントエンド自体も非中央集権化されるべきです——フロントエンドが中央集権的サーバーにホスティングされている場合、コントラクトがオンチェーンで実行されていても、フロントエンドが改ざんされればユーザーに損失をもたらす可能性があります。

### IPFSホスティング

```bash
# フロントエンドをビルド
npm run build

# IPFSにアップロード
ipfs add -r build/

# 出力: QmYourFrontendHash
# アクセス: https://ipfs.io/ipfs/QmYourFrontendHash
```

### ENSバインディング

ENS（Ethereum Name Service）はドメインをIPFSハッシュにマッピングし、読みやすいDAppアドレスを実現します：

```javascript
// ENSコントラクト経由でコンテンツhashを設定
const ensRegistry = new web3.eth.Contract(ENS_REGISTRY_ABI, ENS_REGISTRY_ADDRESS);
const resolver = await ensRegistry.methods.resolver(namehash('mydapp.eth')).call();

const contentHash = encodeIPFSHash('QmYourFrontendHash');
await resolver.methods.setContenthash(namehash('mydapp.eth'), contentHash).send({
    from: account
});

// ユーザーはmydapp.eth経由でDAppにアクセス可能
// ENSをサポートするブラウザ（MetaMask、Braveなど）は自動的にIPFSに解決
```

フロントエンドの更新時にはIPFSへの再アップロードとENSのポインタ更新が必要です——つまり毎回の更新で新しいCIDが生成されます。これはCI/CDフローで自動化処理が必要です。

## アーキテクチャ図解：完全なDApp技術スタック

```
┌─────────────────────────────────────────────────────┐
│                    ユーザーブラウザ                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ MetaMask  │  │  DApp UI  │  │  js-ipfs (任意)  │  │
│  │(ウォレット+署名)│  │ (React/Vue)│  │ (ファイル送受信)  │  │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│        │              │                  │            │
└────────┼──────────────┼──────────────────┼────────────┘
         │              │                  │
    JSON-RPC       web3.js/ethers.js    IPFS HTTP API
         │              │                  │
┌────────┼──────────────┼──────────────────┼────────────┐
│        ▼              ▼                  ▼            │
│  ┌──────────┐  ┌───────────────┐  ┌─────────────┐     │
│  │ Ethereum  │  │ コントラクトABI │  │ IPFSゲートウェイ │     │
│  │ ノード     │  │ + アドレス     │  │ / Pinning   │     │
│  │(Geth/    │  │              │  │   サービス    │     │
│  │ Infura)  │  │              │  │             │     │
│  └────┬─────┘  └───────────────┘  └─────────────┘     │
│       │                                               │
│  ┌────▼──────────────────────────────────────┐        │
│  │         ブロックチェーン（Layer 1）          │        │
│  │  ┌─────────────┐  ┌──────────────────┐    │        │
│  │  │ スマートコントラクト │  │  イベントログ      │    │        │
│  │  │ (ビジネスロジック) │  │  (状態変更記録)   │    │        │
│  │  └─────────────┘  └──────────────────┘    │        │
│  └───────────────────────────────────────────┘        │
│                                                       │
│  ┌───────────────────────────────────────────┐        │
│  │       オフチェーンインデックス層（任意）         │        │
│  │  The Graph / 独自インデックス → GraphQL API       │        │
│  └───────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────┘
```

## DAppフロントエンドアーキテクチャのベースモジュール

```javascript
// dapp-core.js —— DAppフロントエンドアーキテクチャコアモジュール

class DAppCore {
    constructor(config) {
        this.config = config;  // { contractABI, contractAddresses, ipfsGateway }
        this.web3 = null;
        this.account = null;
        this.networkId = null;
        this.contract = null;
        this.state = { synced: false, loading: true };
        this.eventSubscriptions = [];
        this.retries = 0;
    }

    // ===== 初期化 =====
    async init() {
        try {
            await this.connectProvider();
            await this.connectWallet();
            await this.initContract();
            await this.syncState();
            this.startEventListening();
            this.state.loading = false;
            this.state.synced = true;
        } catch (error) {
            this.handleError(error);
        }
    }

    async connectProvider() {
        if (typeof window.ethereum !== 'undefined') {
            this.provider = window.ethereum;
            this.web3 = new Web3(window.ethereum);
        } else if (typeof window.web3 !== 'undefined') {
            this.provider = window.web3.currentProvider;
            this.web3 = new Web3(this.provider);
        } else {
            throw new Error('No Web3 provider found. Please install MetaMask.');
        }
    }

    async connectWallet() {
        if (this.provider.enable) {
            const accounts = await this.provider.enable();
            this.account = accounts[0];
        } else {
            const accounts = await this.web3.eth.getAccounts();
            this.account = accounts[0];
        }

        this.networkId = await this.web3.eth.net.getId();

        if (!this.config.contractAddresses[this.networkId]) {
            throw new Error(`Unsupported network: ${this.networkId}`);
        }

        // アカウントとネットワークの変化をリスニング
        if (this.provider.on) {
            this.provider.on('accountsChanged', (accounts) => {
                this.account = accounts[0];
                this.onAccountChanged();
            });
            this.provider.on('networkChanged', (netId) => {
                this.networkId = netId;
                this.onNetworkChanged();
            });
        }
    }

    async initContract() {
        const address = this.config.contractAddresses[this.networkId];
        this.contract = new this.web3.eth.Contract(this.config.contractABI, address);
    }

    // ===== 状態同期 =====
    async syncState() {
        // コントラクトから現在の状態を読み取り
        const data = await this.contract.methods.getGlobalState().call();
        this.state.data = data;

        // イベントログから履歴を同期
        const events = await this.contract.getPastEvents('allEvents', {
            fromBlock: 0,
            toBlock: 'latest'
        });
        this.state.history = this.processEvents(events);
    }

    startEventListening() {
        const subscription = this.contract.events.allEvents({})
            .on('data', (event) => {
                this.handleNewEvent(event);
            })
            .on('error', (error) => {
                console.error('Event subscription error:', error);
                // 再接続ロジック
                setTimeout(() => this.startEventListening(), 5000);
            });

        this.eventSubscriptions.push(subscription);
    }

    handleNewEvent(event) {
        this.state.history.push(event);
        this.onStateUpdated();
    }

    // ===== トランザクション管理 =====
    async sendTransaction(methodName, args, options = {}) {
        const method = this.contract.methods[methodName](...args);

        // Gasを推定
        const estimatedGas = await method.estimateGas({
            from: this.account,
            value: options.value || 0
        });

        // トランザクションを送信
        return new Promise((resolve, reject) => {
            method.send({
                from: this.account,
                gas: Math.floor(estimatedGas * 1.2),
                gasPrice: options.gasPrice || (await this.web3.eth.getGasPrice()),
                value: options.value || 0
            })
            .on('transactionHash', (hash) => {
                this.onTransactionSubmitted(hash);
            })
            .on('receipt', (receipt) => {
                this.onTransactionConfirmed(receipt);
                resolve(receipt);
            })
            .on('error', (error) => {
                this.onTransactionFailed(error);
                reject(error);
            });
        });
    }

    // ===== ライフサイクルコールバック（サブクラスまたは外部でオーバーライド）=====
    onAccountChanged() { this.init(); }
    onNetworkChanged() { this.init(); }
    onStateUpdated() {}
    onTransactionSubmitted(hash) {}
    onTransactionConfirmed(receipt) {}
    onTransactionFailed(error) {}
    handleError(error) { console.error(error); }
}

module.exports = DAppCore;
```

## よくあるアンチパターンと回避ガイド

### アンチパターン1：すべてのデータをオンチェーンに保存

```solidity
// エラー：ユーザープロフィールをすべてオンチェーンに保存
struct UserProfile {
    string name;      // 高いGasコスト
    string email;     // 高いGasコスト
    string avatar;    // 不必要
    string bio;       // 不必要
}
```

正しいやり方：オンチェーンにはhashのみ保存、オフチェーンにコンテンツを保存。

### アンチパターン2：フロントエンドがトランザクション完了に直接依存

```javascript
// エラー：トランザクション確定を待ってからUIを更新
await contract.methods.purchase(id).send({ from: account, value: price });
// ユーザーはここで15秒待っている...
updateUI();
```

正しいやり方：楽観的更新 + イベント確定。

```javascript
// 楽観的更新
optimisticallyUpdateUI(id);
contract.methods.purchase(id).send({ from: account, value: price })
    .on('receipt', () => confirmUpdate(id))
    .on('error', () => rollbackUpdate(id));
```

### アンチパターン3：コントラクトアドレスのハードコード

```javascript
// エラー
const contractAddress = '0x1234...';
```

正しいやり方：ネットワークIDごとにアドレスマッピングを維持。

### アンチパターン4：チェーン再編成の無視

チェーン再編成は確定済みのブロックがロールバックされる可能性があります。フロントエンドがトランザクションがpendingに入った直後に状態を更新すると、再編成により状態の不整合が発生します。十分な数の確認（通常12ブロック）を待ってから最終状態を確定すべきです。

## まとめ

DAppアーキテクチャのコアの課題は「非中央集権」と「ユーザーエクスペリエンス」のバランスを見つけることにあります。完全な非中央集権化はすべての操作がオンチェーントランザクションで完了することを意味します——しかしそれは高いGasコストと長い確認時間をもたらします。完全な中央集権化はDAppの意義を失います。

DAppアーキテクチャには依然として課題が残ります。ツールチェーンの断片化、状態同期アプローチの不統一、従来Webアプリケーションとの大きなユーザー体験のギャップなどです。しかしアーキテクチャの進化の観点から、いくつかのトレンドが明確です：

1. **階層型ストレージ**がコンセンサスになりつつある——オンチェーンにはコア状態とhashのみ保存
2. **イベント駆動アーキテクチャ**はDAppフロントエンドの自然な選択——ブロックチェーンの非同期トランザクションモデルに合致
3. **インデックスサービス**がクエリ能力の空白を埋める——しかし非中央集権と効率のバランスが必要

フロントエンドエンジニアにとって、DApp開発に入る上での最大の思考の転換は「リクエスト-レスポンス」モデルから「トランザクション-イベント」モデルへの移行です。従来アプリではフロントエンドがバックエンドにリクエストを送りレスポンスを待ちますが、DAppではフロントエンドがオンチェーンにトランザクションを送り、イベントリスニングを通じて結果を確認します。この非同期で最終的に一貫するモデルはユーザーインタラクションフローの再設計を要求します——そしてこれこそがDAppアーキテクチャ設計のコアの課題です。
