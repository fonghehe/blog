---
title: "DApp Architecture Patterns: Design Approaches for Decentralized Applications"
date: 2019-04-12 17:38:01
tags:
  - Web3
  - DApp
  - Architecture
readingTime: 11
wordCount: 1081
description: "Traditional web application architecture has formed mature patterns—frontend-backend separation, RESTful APIs, database read-write splitting, CDN acceleration, "
---

Traditional web application architecture has formed mature patterns—frontend-backend separation, RESTful APIs, database read-write splitting, CDN acceleration, and microservices. But when an application needs to run on a blockchain, nearly all of these patterns must be reconsidered. DApps have no traditional backend servers, no centralized databases, and users authenticate via wallet signatures rather than passwords. This fundamental difference requires developers to develop a new architectural mindset from scratch.

## Core Differences Between DApps and Traditional Web Applications

| Dimension | Traditional Web App | DApp |
|-----------|-------------------|------|
| Backend logic | Server process (Node.js/Java/Go) | Smart contracts (running on EVM) |
| Data storage | Database (MySQL/MongoDB) | On-chain storage + off-chain IPFS |
| Authentication | Username+password / OAuth | Wallet address+signature |
| API calls | HTTP requests | JSON-RPC / contract calls |
| Write operations | Database INSERT/UPDATE | On-chain transactions (consume gas) |
| Read operations | Database SELECT | Contract call / event logs |
| Frontend hosting | CDN / server | IPFS / centralized server |
| Availability | 99.99% SLA | Depends on node availability |
| Performance | Millisecond response | Seconds to minutes for confirmation |

The most fundamental difference lies in the **cost and latency of write operations**. In a traditional application, a database write takes only milliseconds, while in a DApp, a contract call requires waiting for block confirmation (about 15 seconds on Ethereum). This means DApps cannot simply reuse traditional interaction patterns—users cannot be expected to wait 15 seconds after every click.

## Layers of Decentralized Architecture

### Contract Layer

The contract layer is the core business logic of a DApp, running on the EVM:

```solidity
// 合约层：核心业务逻辑
contract Marketplace {
    struct Listing {
        uint256 id;
        address seller;
        uint256 price;
        string ipfsHash;    // 商品信息存储在 IPFS
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

Contract layer design principles:

1. **Minimize on-chain logic**: Only put logic that must be decentralized in contracts
2. **Streamline state**: On-chain storage is expensive—use off-chain solutions where possible
3. **Event-driven**: Expose state changes through events rather than having the frontend poll

### Data Layer

The data layer is divided into on-chain and off-chain parts:

```
链上数据（Storage）
├── 合约状态变量（余额、权限、列表 ID）
├── 合约代码（bytecode）
└── 事件日志（交易历史）

链下数据
├── IPFS（大文件、metadata、商品详情）
├── 索引服务（事件索引、搜索索引）
└── 传统数据库（缓存、非关键数据）
```

Data layering decision framework:

| Data Type | Storage Location | Reason |
|-----------|-----------------|--------|
| Balances, permissions | On-chain storage | Requires consensus and immutability |
| Transaction history | On-chain event logs | Needs to be verifiable |
| Product images | IPFS | Large files, need decentralization |
| Product descriptions | IPFS + on-chain hash | Fixed content, needs integrity verification |
| User preferences | Off-chain database | Non-critical data, no consensus needed |
| Search index | Off-chain indexing service | Requires full-text search capability |

### Frontend Layer

The frontend layer handles user interaction and is the most "traditional" part of a DApp, but with blockchain-specific logic layered on top:

```javascript
// DApp 前端架构
class DAppFrontend {
    constructor() {
        this.web3 = null;          // Web3 实例
        this.account = null;        // 当前账户
        this.contract = null;       // 合约实例
        this.eventWatcher = null;   // 事件监听器
        this.cache = new Map();     // 本地缓存
    }

    async init() {
        // 1. 连接钱包
        await this.connectWallet();

        // 2. 初始化合约
        await this.initContract();

        // 3. 同步历史状态
        await this.syncHistory();

        // 4. 启动事件监听
        this.startEventListening();

        // 5. 渲染初始界面
        await this.render();
    }

    async connectWallet() {
        if (typeof window.ethereum !== 'undefined') {
            const accounts = await window.ethereum.enable();
            this.account = accounts[0];
            this.web3 = new Web3(window.ethereum);

            // 监听账户切换
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

## On-Chain vs Off-Chain Data Design Decisions

This is the most critical decision in DApp architecture—what data goes on-chain and what stays off-chain. The principle is: **only data that must reach consensus in a trustless scenario goes on-chain**.

### Criteria for Going On-Chain

1. **Does it need immutability?** If data should not be modified once written (e.g., ownership records), put it on-chain
2. **Does it need decentralized verification?** If multiple parties need to agree in a trustless environment (e.g., transaction settlement), put it on-chain
3. **Does it need censorship resistance?** If data cannot be deleted by any single party (e.g., DAO voting records), put it on-chain
4. **Is the gas cost acceptable?** If storage costs exceed business value, keep it off-chain

### Hybrid Storage Pattern

```solidity
// 混合存储：链上存 hash，链下存内容
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

Article content is stored on IPFS, with only the content hash recorded on-chain. This ensures content immutability (via hash verification) while keeping storage costs within acceptable limits.

## Decentralized Authentication: Wallet Address as Identity

DApp authentication is fundamentally different from traditional web—no usernames and passwords, no sessions, no JWTs. The user's identity is their wallet address, and authentication is done via private key signatures.

### Signature Authentication Flow

```javascript
class AuthManager {
    constructor(web3) {
        this.web3 = web3;
        this.sessions = new Map();  // address -> session
    }

    // 生成随机 nonce 让用户签名
    async authenticate() {
        const accounts = await this.web3.eth.getAccounts();
        const address = accounts[0];

        // 生成 nonce
        const nonce = Math.random().toString(36).substring(2);
        const message = `Sign this message to authenticate: ${nonce}`;

        // 请求用户签名（不会发送交易，不消耗 Gas）
        const signature = await this.web3.eth.personal.sign(message, address, '');

        // 验证签名
        const recoveredAddress = this.web3.eth.accounts.recover(message, signature);

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            const session = {
                address: address,
                nonce: nonce,
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000  // 1 小时有效期
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

    // 如果需要与链下服务交互，可以将签名发送给服务端验证
    async getAuthToken(address) {
        const session = this.sessions.get(address);
        if (!session) throw new Error('Not authenticated');

        // 将签名和地址发送给链下服务端
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

Advantages of this authentication approach:

1. **No passwords needed**: Users don't need to remember yet another password
2. **No backend account database**: The address is the unique identifier
3. **Phishing resistant**: The signature message is generated by the frontend, and users can see the full message in MetaMask
4. **Cross-DApp universality**: The same wallet address can be used across all DApps

Disadvantages:

1. **Irrecoverable**: Losing the private key means permanent loss of identity
2. **Poor privacy**: All on-chain behavior is publicly associated with the address
3. **UX barriers**: Every operation requires signing, making the experience less smooth than traditional web

## State Synchronization Patterns

### Event-Driven

```javascript
// 事件驱动：监听合约事件，实时更新前端状态
class EventDrivenSync {
    constructor(contract) {
        this.contract = contract;
        this.state = { items: [], balances: {} };
    }

    async init() {
        // 初始同步
        await this.syncHistory();

        // WebSocket 实时监听
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
        // 触发 UI 重渲染
        window.dispatchEvent(new CustomEvent('stateUpdate', {
            detail: this.state
        }));
    }
}
```

### Polling

```javascript
// 轮询：定期查询合约状态
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
        // 直接读取链上状态
        const itemCount = await this.contract.methods.itemCount().call();

        for (let i = 0; i < itemCount; i++) {
            const item = await this.contract.methods.items(i).call();
            // 更新本地状态
            this.updateItem(item);
        }
    }

    stop() {
        clearInterval(this.timer);
    }
}
```

### Indexing Services

```javascript
// 使用索引服务（如 The Graph）
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

### Comparison of Three Patterns

| Pattern | Real-time | Implementation Complexity | Query Capability | Decentralization |
|---------|-----------|--------------------------|-----------------|-----------------|
| Event-driven | High | Medium | Weak (only indexed field filtering) | High |
| Polling | Low | Low | Weak | High |
| Indexing service | Medium | Low (consumer side) | Strong (GraphQL) | Low (depends on indexer) |

## Decentralized Frontend Hosting: IPFS + ENS

A DApp's frontend itself should be decentralized—if the frontend is hosted on a centralized server, even though the contract runs on-chain, a tampered frontend can still cause user losses.

### IPFS Hosting

```bash
# 构建前端
npm run build

# 上传到 IPFS
ipfs add -r build/

# 输出: QmYourFrontendHash
# 访问: https://ipfs.io/ipfs/QmYourFrontendHash
```

### ENS Binding

ENS (Ethereum Name Service) maps domain names to IPFS hashes, enabling human-readable DApp addresses:

```javascript
// 通过 ENS 合约设置内容 hash
const ensRegistry = new web3.eth.Contract(ENS_REGISTRY_ABI, ENS_REGISTRY_ADDRESS);
const resolver = await ensRegistry.methods.resolver(namehash('mydapp.eth')).call();

const contentHash = encodeIPFSHash('QmYourFrontendHash');
await resolver.methods.setContenthash(namehash('mydapp.eth'), contentHash).send({
    from: account
});

// 用户可以通过 mydapp.eth 访问 DApp
// 支持 ENS 的浏览器（如 MetaMask、Brave）会自动解析到 IPFS
```

Updating the frontend requires re-uploading to IPFS and updating the ENS pointer—meaning each update produces a new CID. This needs to be automated in the CI/CD pipeline.

## Architecture Diagram: Complete DApp Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ MetaMask  │  │  DApp UI  │  │  js-ipfs (可选)  │  │
│  │ (钱包+签名)│  │ (React/Vue)│  │  (文件上传/下载)  │  │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│        │              │                  │            │
└────────┼──────────────┼──────────────────┼────────────┘
         │              │                  │
    JSON-RPC       web3.js/ethers.js    IPFS HTTP API
         │              │                  │
┌────────┼──────────────┼──────────────────┼────────────┐
│        ▼              ▼                  ▼            │
│  ┌──────────┐  ┌───────────────┐  ┌─────────────┐     │
│  │  以太坊   │  │  合约 ABI    │  │ IPFS 网关   │     │
│  │  节点     │  │  + 地址      │  │ / Pinning   │     │
│  │ (Geth/   │  │              │  │   服务      │     │
│  │  Infura) │  │              │  │             │     │
│  └────┬─────┘  └───────────────┘  └─────────────┘     │
│       │                                               │
│  ┌────▼──────────────────────────────────────┐        │
│  │         区块链（Layer 1）                  │        │
│  │  ┌─────────────┐  ┌──────────────────┐    │        │
│  │  │ 智能合约     │  │  事件日志         │    │        │
│  │  │ (业务逻辑)  │  │  (状态变更记录)   │    │        │
│  │  └─────────────┘  └──────────────────┘    │        │
│  └───────────────────────────────────────────┘        │
│                                                       │
│  ┌───────────────────────────────────────────┐        │
│  │       链下索引层（可选）                   │        │
│  │  The Graph / 自建索引 → GraphQL API       │        │
│  └───────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────┘
```

## DApp Frontend Architecture Core Module

```javascript
// dapp-core.js —— DApp 前端架构核心模块

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

        // 监听账户和网络变化
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

    // ===== 状态同步 =====
    async syncState() {
        // 从合约读取当前状态
        const data = await this.contract.methods.getGlobalState().call();
        this.state.data = data;

        // 从事件日志同步历史
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
                // 重连逻辑
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

        // 发送交易
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

    // ===== 生命周期回调（由子类或外部覆盖）=====
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

## Common Anti-Patterns and Pitfall Guide

### Anti-Pattern 1: Storing All Data On-Chain

```solidity
// 错误：将用户资料全部上链
struct UserProfile {
    string name;      // 高 Gas 成本
    string email;     // 高 Gas 成本
    string avatar;    // 不必要
    string bio;       // 不必要
}
```

Correct approach: store only hashes on-chain, content off-chain.

### Anti-Pattern 2: Frontend Directly Depending on Transaction Completion

```javascript
// 错误：等待交易确认后才更新 UI
await contract.methods.purchase(id).send({ from: account, value: price });
// 用户在这里等了 15 秒...
updateUI();
```

Correct approach: optimistic updates + event confirmation.

```javascript
// 乐观更新
optimisticallyUpdateUI(id);
contract.methods.purchase(id).send({ from: account, value: price })
    .on('receipt', () => confirmUpdate(id))
    .on('error', () => rollbackUpdate(id));
```

### Anti-Pattern 3: Hardcoding Contract Addresses

```javascript
// 错误
const contractAddress = '0x1234...';
```

Correct approach: maintain an address mapping by network ID.

### Anti-Pattern 4: Ignoring Chain Reorganizations

Chain reorganizations can cause confirmed blocks to be rolled back. If the frontend updates state as soon as a transaction enters pending, a reorg will cause state inconsistency. You should wait for a sufficient number of confirmations (typically 12 blocks) before confirming the final state.

## Summary

The core challenge of DApp architecture is finding the balance between "decentralization" and "user experience." Full decentralization means all operations go through on-chain transactions—but this brings high gas costs and long confirmation times. Full centralization defeats the purpose of a DApp.

DApp architecture still has rough edges today. Toolchain fragmentation, inconsistent state synchronization approaches, and a gap in user experience compared to traditional web applications are real challenges. But several architectural trends are clear:

1. **Layered storage** was emerging as the consensus approach—store only core state and hashes on-chain
2. **Event-driven architecture** is the natural choice for DApp frontends—fitting the blockchain's asynchronous transaction model
3. **Indexing services** will fill the query capability gap—but need to balance decentralization and efficiency

For frontend engineers, the biggest mindset shift in entering DApp development is moving from the "request-response" model to the "transaction-event" model. In traditional applications, the frontend sends requests to the backend and waits for responses. In DApps, the frontend sends transactions on-chain and confirms results through event listening. This asynchronous, eventually consistent model requires redesigning user interaction flows—and this is the core challenge of DApp architecture design.
