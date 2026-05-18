---
readingTime: 9
wordCount: 1819
title: "DApp 架構模式：去中心化應用的設計思路"
date: 2019-04-12 17:38:01
tags:
  - Web3
  - DApp
  - 架構
---

傳統 Web 應用的架構已經形成了成熟的模式——前後端分離、RESTful API、數據庫讀寫分離、CDN 加速、微服務拆分。但當一個應用需要運行在區塊鏈上時，這些模式幾乎全部需要重新審視。DApp 沒有傳統後端服務器，沒有中心化數據庫，用户通過錢包簽名而非密碼認證身份。這種根本性的差異要求開發者從零開始構建一套新的架構思維。

## DApp vs 傳統 Web 應用的核心差異

| 維度 | 傳統 Web 應用 | DApp |
|------|-------------|------|
| 後端邏輯 | 服務器進程（Node.js/Java/Go） | 智能合約（EVM 上運行） |
| 數據存儲 | 數據庫（MySQL/MongoDB） | 鏈上 storage + 鏈下 IPFS |
| 身份認證 | 用户名+密碼 / OAuth | 錢包地址+簽名 |
| API 調用 | HTTP 請求 | JSON-RPC / 合約調用 |
| 寫操作 | 數據庫 INSERT/UPDATE | 交易上鍊（消耗 Gas） |
| 讀操作 | 數據庫 SELECT | 合約 call / 事件日誌 |
| 前端託管 | CDN / 服務器 | IPFS / 中心化服務器 |
| 可用性 | 99.99% SLA | 依賴節點可用性 |
| 性能 | 毫秒級響應 | 秒級到分鐘級確認 |

最根本的差異在於**寫操作的成本和延遲**。傳統應用中一次數據庫寫入只需要幾毫秒，而 DApp 中一次合約調用需要等待區塊確認（以太坊約 15 秒）。這直接決定了 DApp 不能照搬傳統應用的交互模式——用户不可能在每次點擊後等待 15 秒。

## 去中心化架構的層次

### 合約層

合約層是 DApp 的業務邏輯核心，運行在 EVM 上：

```solidity
// 合約層：核心業務邏輯
contract Marketplace {
    struct Listing {
        uint256 id;
        address seller;
        uint256 price;
        string ipfsHash;    // 商品信息存儲在 IPFS
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

合約層的設計原則：

1. **最小化上鍊邏輯**：只將必須去中心化的邏輯放在合約中
2. **狀態精簡**：鏈上存儲昂貴，能用鏈下解決的就用鏈下
3. **事件驅動**：通過 event 暴露狀態變化，而非讓前端輪詢讀取

### 數據層

數據層分為鏈上和鏈下兩部分：

```
鏈上數據（Storage）
├── 合約狀態變量（餘額、權限、列表 ID）
├── 合約代碼（bytecode）
└── 事件日誌（交易歷史）

鏈下數據
├── IPFS（大文件、metadata、商品詳情）
├── 索引服務（事件索引、搜索索引）
└── 傳統數據庫（緩存、非關鍵數據）
```

數據分層的決策框架：

| 數據類型 | 存儲位置 | 原因 |
|---------|---------|------|
| 餘額、權限 | 鏈上 storage | 需要共識和不可篡改 |
| 交易歷史 | 鏈上 event logs | 需要可驗證 |
| 商品圖片 | IPFS | 大文件，需要去中心化 |
| 商品描述 | IPFS + 鏈上 hash | 內容固定，需驗證完整性 |
| 用户偏好設置 | 鏈下數據庫 | 非關鍵數據，無需共識 |
| 搜索索引 | 鏈下索引服務 | 需要全文檢索能力 |

### 前端層

前端層負責與用户交互，是 DApp 中最"傳統"的部分，但增加了區塊鏈特有的邏輯：

```javascript
// DApp 前端架構
class DAppFrontend {
    constructor() {
        this.web3 = null;          // Web3 實例
        this.account = null;        // 當前賬户
        this.contract = null;       // 合約實例
        this.eventWatcher = null;   // 事件監聽器
        this.cache = new Map();     // 本地緩存
    }

    async init() {
        // 1. 連接錢包
        await this.connectWallet();

        // 2. 初始化合約
        await this.initContract();

        // 3. 同步歷史狀態
        await this.syncHistory();

        // 4. 啓動事件監聽
        this.startEventListening();

        // 5. 渲染初始界面
        await this.render();
    }

    async connectWallet() {
        if (typeof window.ethereum !== 'undefined') {
            const accounts = await window.ethereum.enable();
            this.account = accounts[0];
            this.web3 = new Web3(window.ethereum);

            // 監聽賬户切換
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

## 鏈上數據 vs 鏈下數據的設計決策

這是 DApp 架構中最關鍵的決策——哪些數據上鍊，哪些數據不上鍊。原則是：**只有在去信任場景下必須達成共識的數據才上鍊**。

### 上鍊的判斷標準

1. **是否需要不可篡改？** 如果數據一旦寫入就不應被修改（如所有權記錄），上鍊
2. **是否需要去中心化驗證？** 如果多方需要在不信任環境下達成一致（如交易結算），上鍊
3. **是否需要抗審查？** 如果數據不能被任何單方刪除（如 DAO 投票記錄），上鍊
4. **Gas 成本是否可接受？** 如果存儲成本超過業務收益，不上鍊

### 混合存儲模式

```solidity
// 混合存儲：鏈上存 hash，鏈下存內容
contract DecentralizedBlog {
    struct Post {
        bytes32 contentHash;    // IPFS CID 的哈希
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

文章內容存儲在 IPFS 上，鏈上只記錄內容的 hash。這樣既保證了內容的不可篡改性（hash 驗證），又將存儲成本控制在可接受範圍內。

## 去中心化身份驗證：錢包地址即身份

DApp 的身份驗證模型與傳統 Web 完全不同——沒有用户名和密碼，沒有 session，沒有 JWT。用户的身份就是其錢包地址，認證方式是私鑰簽名。

### 簽名認證流程

```javascript
class AuthManager {
    constructor(web3) {
        this.web3 = web3;
        this.sessions = new Map();  // address -> session
    }

    // 生成隨機 nonce 讓用户簽名
    async authenticate() {
        const accounts = await this.web3.eth.getAccounts();
        const address = accounts[0];

        // 生成 nonce
        const nonce = Math.random().toString(36).substring(2);
        const message = `Sign this message to authenticate: ${nonce}`;

        // 請求用户簽名（不會發送交易，不消耗 Gas）
        const signature = await this.web3.eth.personal.sign(message, address, '');

        // 驗證簽名
        const recoveredAddress = this.web3.eth.accounts.recover(message, signature);

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            const session = {
                address: address,
                nonce: nonce,
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000  // 1 小時有效期
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

    // 如果需要與鏈下服務交互，可以將簽名發送給服務端驗證
    async getAuthToken(address) {
        const session = this.sessions.get(address);
        if (!session) throw new Error('Not authenticated');

        // 將簽名和地址發送給鏈下服務端
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

這種認證方式的優勢：

1. **無需密碼**：用户不需要記住另一個密碼
2. **無需後端賬户數據庫**：地址就是唯一標識
3. **防釣魚**：簽名消息由前端生成，用户可以在 MetaMask 中看到完整消息
4. **跨 DApp 通用**：同一錢包地址可以在所有 DApp 中使用

劣勢：

1. **不可恢復**：私鑰丟失意味着身份永久丟失
2. **隱私性差**：所有鏈上行為都與地址公開關聯
3. **UX 障礙**：每次操作需要簽名，用户體驗不如傳統 Web 流暢

## 狀態同步模式

### 事件驅動

```javascript
// 事件驅動：監聽合約事件，實時更新前端狀態
class EventDrivenSync {
    constructor(contract) {
        this.contract = contract;
        this.state = { items: [], balances: {} };
    }

    async init() {
        // 初始同步
        await this.syncHistory();

        // WebSocket 實時監聽
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
        // 觸發 UI 重渲染
        window.dispatchEvent(new CustomEvent('stateUpdate', {
            detail: this.state
        }));
    }
}
```

### 輪詢

```javascript
// 輪詢：定期查詢合約狀態
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
        // 直接讀取鏈上狀態
        const itemCount = await this.contract.methods.itemCount().call();

        for (let i = 0; i < itemCount; i++) {
            const item = await this.contract.methods.items(i).call();
            // 更新本地狀態
            this.updateItem(item);
        }
    }

    stop() {
        clearInterval(this.timer);
    }
}
```

### 索引服務

```javascript
// 使用索引服務（如 The Graph）
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

### 三種模式對比

| 模式 | 實時性 | 實現複雜度 | 查詢能力 | 去中心化程度 |
|------|--------|-----------|---------|-------------|
| 事件驅動 | 高 | 中 | 弱（只能按 indexed 字段過濾） | 高 |
| 輪詢 | 低 | 低 | 弱 | 高 |
| 索引服務 | 中 | 低（消費端） | 強（GraphQL） | 低（依賴索引器） |

## 前端託管去中心化：IPFS + ENS

DApp 的前端本身也應該去中心化——如果前端託管在中心化服務器上，即使合約在鏈上運行，前端被篡改仍可能導致用户損失。

### IPFS 託管

```bash
# 構建前端
npm run build

# 上傳到 IPFS
ipfs add -r build/

# 輸出: QmYourFrontendHash
# 訪問: https://ipfs.io/ipfs/QmYourFrontendHash
```

### ENS 綁定

ENS（Ethereum Name Service）將域名映射到 IPFS hash，實現可讀的 DApp 地址：

```javascript
// 通過 ENS 合約設置內容 hash
const ensRegistry = new web3.eth.Contract(ENS_REGISTRY_ABI, ENS_REGISTRY_ADDRESS);
const resolver = await ensRegistry.methods.resolver(namehash('mydapp.eth')).call();

const contentHash = encodeIPFSHash('QmYourFrontendHash');
await resolver.methods.setContenthash(namehash('mydapp.eth'), contentHash).send({
    from: account
});

// 用户可以通過 mydapp.eth 訪問 DApp
// 支持 ENS 的瀏覽器（如 MetaMask、Brave）會自動解析到 IPFS
```

更新前端時需要重新上傳 IPFS 並更新 ENS 指向——這意味着每次更新都會產生新的 CID。這在 CI/CD 流程中需要自動化處理。

## 架構圖解：完整的 DApp 技術棧

```
┌─────────────────────────────────────────────────────┐
│                    用户瀏覽器                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ MetaMask  │  │  DApp UI  │  │  js-ipfs (可選)  │  │
│  │ (錢包+簽名)│  │ (React/Vue)│  │  (文件上傳/下載)  │  │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│        │              │                  │            │
└────────┼──────────────┼──────────────────┼────────────┘
         │              │                  │
    JSON-RPC       web3.js/ethers.js    IPFS HTTP API
         │              │                  │
┌────────┼──────────────┼──────────────────┼────────────┐
│        ▼              ▼                  ▼            │
│  ┌──────────┐  ┌───────────────┐  ┌─────────────┐     │
│  │  以太坊   │  │  合約 ABI    │  │ IPFS 網關   │     │
│  │  節點     │  │  + 地址      │  │ / Pinning   │     │
│  │ (Geth/   │  │              │  │   服務      │     │
│  │  Infura) │  │              │  │             │     │
│  └────┬─────┘  └───────────────┘  └─────────────┘     │
│       │                                               │
│  ┌────▼──────────────────────────────────────┐        │
│  │         區塊鏈（Layer 1）                  │        │
│  │  ┌─────────────┐  ┌──────────────────┐    │        │
│  │  │ 智能合約     │  │  事件日誌         │    │        │
│  │  │ (業務邏輯)  │  │  (狀態變更記錄)   │    │        │
│  │  └─────────────┘  └──────────────────┘    │        │
│  └───────────────────────────────────────────┘        │
│                                                       │
│  ┌───────────────────────────────────────────┐        │
│  │       鏈下索引層（可選）                   │        │
│  │  The Graph / 自建索引 → GraphQL API       │        │
│  └───────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────┘
```

## DApp 前端架構基礎模塊

```javascript
// dapp-core.js —— DApp 前端架構核心模塊

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

    // ===== 初始化 =====
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

        // 監聽賬户和網絡變化
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

    // ===== 狀態同步 =====
    async syncState() {
        // 從合約讀取當前狀態
        const data = await this.contract.methods.getGlobalState().call();
        this.state.data = data;

        // 從事件日誌同步歷史
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
                // 重連邏輯
                setTimeout(() => this.startEventListening(), 5000);
            });

        this.eventSubscriptions.push(subscription);
    }

    handleNewEvent(event) {
        this.state.history.push(event);
        this.onStateUpdated();
    }

    // ===== 交易管理 =====
    async sendTransaction(methodName, args, options = {}) {
        const method = this.contract.methods[methodName](...args);

        // 估算 Gas
        const estimatedGas = await method.estimateGas({
            from: this.account,
            value: options.value || 0
        });

        // 發送交易
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

    // ===== 生命週期回調（由子類或外部覆蓋）=====
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

## 常見反模式與避坑指南

### 反模式 1：將所有數據存儲在鏈上

```solidity
// 錯誤：將用户資料全部上鍊
struct UserProfile {
    string name;      // 高 Gas 成本
    string email;     // 高 Gas 成本
    string avatar;    // 不必要
    string bio;       // 不必要
}
```

正確做法：鏈上只存 hash，鏈下存內容。

### 反模式 2：前端直接依賴交易完成

```javascript
// 錯誤：等待交易確認後才更新 UI
await contract.methods.purchase(id).send({ from: account, value: price });
// 用户在這裏等了 15 秒...
updateUI();
```

正確做法：樂觀更新 + 事件確認。

```javascript
// 樂觀更新
optimisticallyUpdateUI(id);
contract.methods.purchase(id).send({ from: account, value: price })
    .on('receipt', () => confirmUpdate(id))
    .on('error', () => rollbackUpdate(id));
```

### 反模式 3：硬編碼合約地址

```javascript
// 錯誤
const contractAddress = '0x1234...';
```

正確做法：按網絡 ID 維護地址映射。

### 反模式 4：忽視鏈重組

鏈重組會導致已確認的區塊被回滾。如果前端在交易剛進入pending就更新狀態，重組會導致狀態不一致。應等待足夠多的確認（通常 12 個區塊）後再確認最終狀態。

## 小結

DApp 架構的核心挑戰在於在"去中心化"與"用户體驗"之間尋找平衡。完全去中心化意味着所有操作都通過鏈上交易完成——但這會帶來高昂的 Gas 成本和漫長的確認時間。完全中心化則失去了 DApp 的意義。

DApp 架構長期處於快速演化中。工具鏈碎片化、狀態同步方案不統一、用户體驗與傳統 Web 應用仍有差距。但幾個核心方向已經清晰：

1. **分層存儲**正在成為共識——鏈上只存核心狀態和 hash
2. **事件驅動架構**是 DApp 前端的天然選擇——契合區塊鏈的異步交易模型
3. **索引服務**將填補查詢能力的空白——但需要平衡去中心化與效率

對於前端工程師，進入 DApp 開發最大的思維轉變是從"請求-響應"模型轉向"交易-事件"模型。傳統應用中前端向後端發請求並等待響應，DApp 中前端向鏈上發交易並通過事件監聽確認結果。這種異步、最終一致性的模型要求重新設計用户交互流程——而這正是 DApp 架構設計的核心課題。
