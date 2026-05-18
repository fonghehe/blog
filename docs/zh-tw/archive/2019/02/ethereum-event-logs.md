---
readingTime: 9
wordCount: 1837
title: "以太坊事件日誌：從 Event 到前端數據同步"
date: 2019-02-25 10:13:14
tags:
  - Web3
  - Ethereum
  - Smart Contract
---

以太坊的智能合約本質上是一個狀態機——外部交易觸發狀態轉換，區塊確認後狀態不可逆。但合約內部的狀態變量並不能被外部直接讀取（除了 `public` 變量通過自動生成的 getter），更無法追蹤狀態變化的歷史。Event 機制填補了這一空白：它是合約向外部世界"廣播"信息的唯一通道，也是前端 DApp 實現狀態同步的核心數據源。

## Solidity event 聲明與 emit 關鍵字

### Event 聲明

Event 在合約中以 `event` 關鍵字聲明，類似函數簽名但不可調用：

```solidity
pragma solidity ^0.4.24;

contract Token {
    // 基本事件聲明
    event Transfer(address indexed from, address indexed to, uint256 value);

    // 包含非索引參數的事件
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // 帶字符串描述的事件
    event Deposit(address indexed account, uint256 amount, string message, uint256 timestamp);

    // 多索引參數事件
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed trader,
        uint256 indexed price,
        uint256 amount,
        uint8 orderType  // 0=buy, 1=sell
    );
}
```

### emit 關鍵字

Solidity 0.4.21 開始引入 `emit` 關鍵字來觸發事件（舊版本直接調用事件名）：

```solidity
function transfer(address _to, uint256 _value) public returns (bool) {
    require(balances[msg.sender] >= _value);

    balances[msg.sender] -= _value;
    balances[_to] += _value;

    // 觸發事件（Solidity 0.4.21+）
    emit Transfer(msg.sender, _to, _value);

    // 舊寫法（不推薦，0.5.0+ 會編譯報錯）
    // Transfer(msg.sender, _to, _value);

    return true;
}
```

`emit` 關鍵字的引入不是語法糖——它明確區分了事件調用和函數調用，避免開發者誤將事件名當作函數調用，也使靜態分析工具能更準確地識別事件觸發點。

## indexed 參數與主題（topics）的索引機制

Event 的參數分為兩類：**indexed** 和 **non-indexed**。兩者的存儲位置和檢索方式完全不同。

### indexed 參數

`indexed` 參數會被編碼到日誌的 `topics` 數組中，可以被高效檢索。一個事件最多可以有 3 個 `indexed` 參數（`anonymous` 事件可以有 4 個）：

```solidity
event Transfer(
    address indexed from,    // topic[1]
    address indexed to,      // topic[2]
    uint256 indexed tokenId, // topic[3]
    uint256 value            // data（非索引）
);
// topic[0] 是事件簽名的 keccak256 哈希
```

`topics[0]` 固定為事件簽名的哈希值：

```
topics[0] = keccak256("Transfer(address,address,uint256,uint256)")
          = 0xe192daff...
```

對於值類型（address, uint256, bytes32 等），`indexed` 參數的值直接存儲在 topic 中。但對於引用類型（string, bytes, array），只存儲其 keccak256 哈希值：

```solidity
event FileUploaded(
    address indexed uploader,
    string indexed fileName,  // 只存儲哈希，無法從日誌還原原值
    string fileHash           // 非索引，存儲在 data 中，可還原
);
```

這是一個常見陷阱：如果需要從日誌中獲取完整的字符串值，不要將其設為 `indexed`。

### non-indexed 參數

非索引參數使用 ABI 編碼後存儲在日誌的 `data` 字段中。`data` 字段不參與索引，但包含完整的原始值：

```solidity
event UserRegistered(
    address indexed userAddress,  // topic[1]，可檢索
    uint256 indexed timestamp,    // topic[2]，可檢索
    string name,                  // data，完整值
    string email,                 // data，完整值
    uint8 role                    // data，完整值
);
```

## anonymous 事件

`anonymous` 事件不會在 `topics[0]` 中存儲事件簽名哈希，從而多出一個 `indexed` 參數槽位：

```solidity
event LogSomething(
    address indexed a,
    address indexed b,
    uint256 indexed c,
    uint256 indexed d  // 匿名事件可以有 4 個 indexed 參數
) anonymous;
```

匿名事件省略了 `topics[0]` 的 32 字節存儲，理論上更省 Gas。但代價是無法通過事件簽名來過濾——檢索匿名事件時只能通過其他 indexed 參數定位。實際項目中極少使用匿名事件，因為可讀性和可維護性的損失遠超微小的 Gas 節省。

## log 結構

以太坊區塊中的每筆交易回執（receipt）包含一個 `logs` 數組。每個 log 的結構如下：

```json
{
    "address": "0x1234...contract_address",
    "topics": [
        "0xe192daff...",  // topics[0]: 事件簽名哈希
        "0x000...000abcd", // topics[1]: from (address 補零到 32 字節)
        "0x000...000efgh", // topics[2]: to
        "0x000...000042"   // topics[3]: tokenId
    ],
    "data": "0x000...000000064",  // ABI 編碼的 non-indexed 參數
    "blockNumber": "0x4b3",       // 區塊號
    "transactionHash": "0x...",   // 觸發該事件的交易哈希
    "transactionIndex": "0x0",
    "blockHash": "0x...",
    "logIndex": "0x0",            // 區塊內的日誌序號
    "removed": false              // 是否因鏈重組被移除
}
```

理解 log 結構對於手動解析事件數據很重要——當 web3.js 的 ABI 解碼失敗或需要從原始日誌中提取信息時，需要直接操作 `topics` 和 `data`。

```javascript
// 手動解析 log data
const web3 = new Web3(provider);

// 假設事件為 Transfer(address,address,uint256,uint256)
// 非 indexed 參數 value 編碼在 data 中
function parseTransferData(dataHex) {
    // data 是 ABI 編碼，每 32 字節一個參數
    const value = web3.utils.hexToNumberString('0x' + dataHex.slice(2, 66));
    return { value };
}

// 從 topic 中解析 address
function parseAddressFromTopic(topicHex) {
    // topic 中 address 補零到 32 字節，取後 20 字節
    return '0x' + topicHex.slice(26);
}

// 解析完整事件
function parseTransferLog(log) {
    return {
        contract: log.address,
        from: parseAddressFromTopic(log.topics[1]),
        to: parseAddressFromTopic(log.topics[2]),
        tokenId: web3.utils.hexToNumberString(log.topics[3]),
        value: parseTransferData(log.data).value,
        blockNumber: web3.utils.hexToNumber(log.blockNumber),
        txHash: log.transactionHash
    };
}
```

## web3.eth.getPastEvents 查詢歷史事件

查詢歷史事件是前端 DApp 的核心需求——從合約部署以來發生的所有 Transfer 事件中重建用戶餘額、交易記錄等狀態。

```javascript
const contract = new web3.eth.Contract(abi, contractAddress);

// 查詢所有 Transfer 事件
const allEvents = await contract.getPastEvents('Transfer', {
    fromBlock: 0,
    toBlock: 'latest'
});

// 按 from 地址過濾
const sentEvents = await contract.getPastEvents('Transfer', {
    filter: { from: '0xUserAddress' },
    fromBlock: 0,
    toBlock: 'latest'
});

// 按 from 和 to 同時過濾
const specificTransfers = await contract.getPastEvents('Transfer', {
    filter: {
        from: '0xUserA',
        to: '0xUserB'
    },
    fromBlock: 5000000,
    toBlock: 'latest'
});

// 按區塊範圍查詢
const recentEvents = await contract.getPastEvents('Transfer', {
    fromBlock: web3.utils.toHex(currentBlock - 1000),
    toBlock: 'latest'
});

// 查詢所有事件類型
const allEventTypes = await contract.getPastEvents('allEvents', {
    fromBlock: currentBlock - 100,
    toBlock: 'latest'
});
```

### 性能考量

`getPastEvents` 的底層 RPC 調用是 `eth_getLogs`，其性能取決於：

1. **查詢範圍**：掃描的區塊數量越多，響應越慢。某些節點（如 Infura）對單次查詢的區塊範圍有限制（通常 5000-10000 個區塊）
2. **過濾條件**：有 `indexed` 過濾條件的查詢比無過濾條件的查詢快得多——節點可以利用 Bloom Filter 快速跳過不包含目標事件的區塊
3. **事件數量**：返回大量事件會導致 JSON 響應體過大，可能觸發節點的響應大小限制

```javascript
// 分塊查詢大範圍事件
async function getEventsInChunks(contract, eventName, filter, fromBlock, toBlock, chunkSize = 2000) {
    const allEvents = [];
    let currentBlock = fromBlock;

    while (currentBlock <= toBlock) {
        const endBlock = Math.min(currentBlock + chunkSize - 1, toBlock);

        try {
            const events = await contract.getPastEvents(eventName, {
                filter: filter,
                fromBlock: currentBlock,
                toBlock: endBlock
            });
            allEvents.push(...events);
        } catch (error) {
            // 縮小範圍重試
            if (error.message.includes('query returned more than') || error.message.includes('limit')) {
                return getEventsInChunks(contract, eventName, filter, currentBlock, endBlock, chunkSize / 2);
            }
            throw error;
        }

        currentBlock = endBlock + 1;
    }

    return allEvents;
}
```

## 事件訂閱：WebSocket 實時監聽 vs 輪詢

### WebSocket 實時監聽

```javascript
// 通過 WebSocket Provider 訂閱事件
const web3ws = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws'));

const wsContract = new web3ws.eth.Contract(abi, contractAddress);

// 訂閱 Transfer 事件
const subscription = wsContract.events.Transfer({
    filter: { to: '0xUserAddress' },  // 只監聽轉入用戶地址的事件
    fromBlock: 'latest'                // 從最新區塊開始
})
.on('data', function(event) {
    console.log('Transfer received!');
    console.log('From:', event.returnValues.from);
    console.log('To:', event.returnValues.to);
    console.log('Value:', event.returnValues.value);
    console.log('Block:', event.blockNumber);
    console.log('TxHash:', event.transactionHash);

    // 更新前端狀態
    updateUI(event.returnValues);
})
.on('changed', function(event) {
    // 鏈重組導致事件被移除
    console.log('Event removed due to reorg:', event.transactionHash);
    rollbackState(event);
})
.on('error', function(error) {
    console.error('Subscription error:', error);
    // 重連邏輯
    reconnectWebSocket();
});

// 取消訂閱
function stopListening() {
    subscription.unsubscribe(function(error, success) {
        if (success) console.log('Unsubscribed');
    });
}
```

WebSocket 訂閱的優勢是實時性——事件在區塊確認後幾乎立即推送到前端。但 WebSocket 連接的穩定性是主要問題：Infura 的 WS 端點經常斷連，網絡切換或休眠的筆記本都會導致連接中斷。

### 輪詢

```javascript
// 輪詢查詢新事件
class EventPoller {
    constructor(contract, eventName, filter, interval = 5000) {
        this.contract = contract;
        this.eventName = eventName;
        this.filter = filter;
        this.interval = interval;
        this.lastBlock = 0;
        this.timer = null;
        this.callbacks = [];
    }

    async start() {
        this.lastBlock = await web3.eth.getBlockNumber();
        this.timer = setInterval(() => this.poll(), this.interval);
    }

    stop() {
        clearInterval(this.timer);
    }

    on(callback) {
        this.callbacks.push(callback);
    }

    async poll() {
        try {
            const currentBlock = await web3.eth.getBlockNumber();

            if (currentBlock <= this.lastBlock) return;

            const events = await this.contract.getPastEvents(this.eventName, {
                filter: this.filter,
                fromBlock: this.lastBlock + 1,
                toBlock: currentBlock
            });

            events.forEach(event => {
                this.callbacks.forEach(cb => cb(event));
            });

            this.lastBlock = currentBlock;
        } catch (error) {
            console.error('Polling error:', error);
        }
    }
}

// 使用
const poller = new EventPoller(
    contract,
    'Transfer',
    { to: userAddress },
    5000
);
poller.on(event => updateBalance(event));
poller.start();
```

### 兩種模式對比

| 特性 | WebSocket | 輪詢 |
|------|-----------|------|
| 實時性 | 高（秒級） | 低（取決於間隔） |
| 穩定性 | 低（易斷連） | 高（HTTP 請求） |
| 資源消耗 | 低（服務端推送） | 中（定時請求） |
| 實現複雜度 | 中（需處理重連） | 低 |
| 鏈重組處理 | 支持（changed 事件） | 需手動處理 |
| Infura 兼容性 | 有限 | 好 |

## 前端狀態同步策略：從事件日誌重建狀態

這是 Event 機制最重要的應用場景——通過事件日誌重建合約的當前狀態。

### 問題背景

合約存儲了狀態變量（如 `balances` mapping），但前端無法高效地查詢某個用戶的所有交易歷史。如果前端需要展示"用戶的所有代幣轉賬記錄"或"訂單簿的當前狀態"，只能通過遍歷歷史事件來重建。

### 狀態同步模塊

```javascript
// state-sync.js —— 從事件日誌重建前端狀態

class StateSynchronizer {
    constructor(web3, contractAddress, abi) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(abi, contractAddress);
        this.syncedBlock = 0;
        this.state = {
            balances: {},      // { address: balance }
            transfers: [],     // 轉賬歷史
            allowances: {}     // { owner: { spender: amount } }
        };
    }

    async sync(fromBlock = 0) {
        const latestBlock = await this.web3.eth.getBlockNumber();
        const chunkSize = 2000;

        // 分塊同步歷史事件
        for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, latestBlock);

            const events = await this.contract.getPastEvents('allEvents', {
                fromBlock: start,
                toBlock: end
            });

            this.processEvents(events);
        }

        this.syncedBlock = latestBlock;
        return this.state;
    }

    processEvents(events) {
        events.forEach(event => {
            switch (event.event) {
                case 'Transfer':
                    this.handleTransfer(event);
                    break;
                case 'Approval':
                    this.handleApproval(event);
                    break;
                case 'Deposit':
                    this.handleDeposit(event);
                    break;
            }
        });
    }

    handleTransfer(event) {
        const { from, to, value } = event.returnValues;
        const amount = BigInt(value);

        // 更新餘額
        if (from !== '0x0000000000000000000000000000000000000000') {
            this.state.balances[from] = (BigInt(this.state.balances[from] || 0) - amount).toString();
        }
        this.state.balances[to] = (BigInt(this.state.balances[to] || 0) + amount).toString();

        // 記錄轉賬歷史
        this.state.transfers.push({
            from,
            to,
            value: amount.toString(),
            blockNumber: event.blockNumber,
            txHash: event.transactionHash,
            timestamp: event.blockTimestamp  // 需要額外獲取區塊信息
        });
    }

    handleApproval(event) {
        const { owner, spender, value } = event.returnValues;

        if (!this.state.allowances[owner]) {
            this.state.allowances[owner] = {};
        }
        this.state.allowances[owner][spender] = value;
    }

    handleDeposit(event) {
        const { account, amount } = event.returnValues;
        this.state.balances[account] = (BigInt(this.state.balances[account] || 0) + BigInt(amount)).toString();
    }

    // 增量同步新事件
    async syncNewEvents() {
        const latestBlock = await this.web3.eth.getBlockNumber();

        if (latestBlock <= this.syncedBlock) return;

        const events = await this.contract.getPastEvents('allEvents', {
            fromBlock: this.syncedBlock + 1,
            toBlock: latestBlock
        });

        this.processEvents(events);
        this.syncedBlock = latestBlock;

        return events;
    }

    // 處理鏈重組
    async handleReorg(reorgBlock) {
        // 回滾到重組點之前的狀態，重新同步
        this.syncedBlock = reorgBlock - 1;
        // 在實際實現中需要保存狀態快照以支持回滾
        await this.sync(reorgBlock);
    }

    getState() {
        return this.state;
    }

    getBalance(address) {
        return this.state.balances[address] || '0';
    }

    getTransferHistory(address) {
        return this.state.transfers.filter(
            t => t.from === address || t.to === address
        );
    }
}
```

## 事件監聽器與狀態同步模塊

將 WebSocket 實時監聽與歷史同步結合的完整模塊：

```javascript
// event-watcher.js
class EventWatcher {
    constructor(web3, contractAddress, abi, options = {}) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(abi, contractAddress);
        this.options = {
            wsUrl: options.wsUrl || null,
            pollInterval: options.pollInterval || 10000,
            chunkSize: options.chunkSize || 2000,
            confirmations: options.confirmations || 12
        };

        this.syncedBlock = 0;
        this.listeners = new Map();  // eventName -> callbacks[]
        this.subscription = null;
        this.pollTimer = null;
        this.useWebSocket = false;
    }

    async start() {
        // 先同步歷史事件
        await this.syncHistory();

        // 嘗試 WebSocket 實時監聽
        if (this.options.wsUrl) {
            try {
                await this.startWebSocket();
                this.useWebSocket = true;
            } catch (error) {
                console.warn('WebSocket failed, falling back to polling:', error.message);
                this.startPolling();
            }
        } else {
            this.startPolling();
        }
    }

    async syncHistory() {
        const latestBlock = await this.web3.eth.getBlockNumber();
        console.log(`Syncing events from block 0 to ${latestBlock}...`);

        for (let start = 0; start <= latestBlock; start += this.options.chunkSize) {
            const end = Math.min(start + this.options.chunkSize - 1, latestBlock);
            const events = await this.contract.getPastEvents('allEvents', {
                fromBlock: start,
                toBlock: end
            });
            this.notifyListeners(events);
        }

        this.syncedBlock = latestBlock;
        console.log('Historical sync complete');
    }

    async startWebSocket() {
        const web3ws = new Web3(new Web3.providers.WebsocketProvider(this.options.wsUrl));
        const wsContract = new web3ws.eth.Contract(this.contract.options.jsonInterface, this.contract.options.address);

        this.subscription = wsContract.events.allEvents({
            fromBlock: this.syncedBlock + 1
        })
        .on('data', (event) => {
            this.notifyListeners([event]);
            this.syncedBlock = Math.max(this.syncedBlock, event.blockNumber);
        })
        .on('error', (error) => {
            console.error('WebSocket error:', error);
            this.subscription = null;
            this.startPolling();
        });
    }

    startPolling() {
        this.pollTimer = setInterval(async () => {
            try {
                const latestBlock = await this.web3.eth.getBlockNumber();
                const confirmedBlock = latestBlock - this.options.confirmations;

                if (confirmedBlock <= this.syncedBlock) return;

                const events = await this.contract.getPastEvents('allEvents', {
                    fromBlock: this.syncedBlock + 1,
                    toBlock: confirmedBlock
                });

                this.notifyListeners(events);
                this.syncedBlock = confirmedBlock;
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, this.options.pollInterval);
    }

    notifyListeners(events) {
        events.forEach(event => {
            const callbacks = this.listeners.get(event.event) || [];
            callbacks.forEach(cb => cb(event));

            // 也通知 'allEvents' 監聽器
            const allCallbacks = this.listeners.get('*') || [];
            allCallbacks.forEach(cb => cb(event));
        });
    }

    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }

    off(eventName, callback) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            const idx = callbacks.indexOf(callback);
            if (idx > -1) callbacks.splice(idx, 1);
        }
    }

    stop() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
    }
}

module.exports = { StateSynchronizer, EventWatcher };
```

## 事件過濾的性能考量

### Bloom Filter

以太坊每個區塊頭都包含一個 Bloom Filter，用於快速判斷該區塊是否包含特定地址或主題的日誌。`eth_getLogs` 在節點端會先檢查 Bloom Filter，跳過不相關的區塊。這就是為什麼有 `indexed` 過濾條件的查詢比無過濾條件的查詢快得多。

### 前端緩存

對於頻繁查詢的事件，前端應實現本地緩存：

```javascript
class EventCache {
    constructor() {
        this.cache = new Map();
    }

    getKey(eventName, filter, fromBlock, toBlock) {
        return `${eventName}:${JSON.stringify(filter)}:${fromBlock}:${toBlock}`;
    }

    get(eventName, filter, fromBlock, toBlock) {
        return this.cache.get(this.getKey(eventName, filter, fromBlock, toBlock));
    }

    set(eventName, filter, fromBlock, toBlock, events) {
        this.cache.set(this.getKey(eventName, filter, fromBlock, toBlock), events);
    }

    invalidate(eventName) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(eventName + ':')) {
                this.cache.delete(key);
            }
        }
    }
}
```

## 與 The Graph 等索引服務的對比展望

從事件日誌重建狀態的方案在合約邏輯簡單時可以接受，但隨著事件類型增多和查詢複雜度上升，前端的同步邏輯會變得臃腫且難以維護。

The Graph 提出了另一種思路：將事件索引和狀態重建的工作交給專門的索引服務。索引器監聽鏈上事件，按照預定義的 schema 將數據存入數據庫，前端通過 GraphQL 查詢結構化數據。

```graphql
# The Graph 的查詢方式（概念展示）
{
  transfers(where: { to: "0xUserAddress" }) {
    id
    from
    to
    value
    blockNumber
    transactionHash
  }
}
```

這種方案將狀態同步的複雜度從前端轉移到了索引層，讓前端迴歸到"查詢-展示"的傳統模式。但代價是引入了對中心化索引服務的依賴——這與去中心化的理念存在張力。

## 小結

以太坊的事件日誌機制是合約與外部世界溝通的核心通道。它看似簡單——聲明 event、emit event、監聽 event——但圍繞它構建的狀態同步體系是 DApp 前端架構中最複雜的部分之一。

indexed 參數的 3 個限制、引用類型只存儲哈希、節點對 `eth_getLogs` 的範圍限制、WebSocket 的不穩定性、鏈重組導致的事件回滾——每個細節都可能成為生產環境中的隱患。

從架構角度，事件驅動的狀態同步模式本質上是一種 CQRS（Command Query Responsibility Segregation）：合約負責命令處理（狀態寫入），事件日誌負責查詢側的數據構建。這種分離是去中心化架構的必然選擇——因為合約本身無法高效地響應複雜查詢。

從事件重建狀態的方案雖然可行但不夠優雅。The Graph 等索引服務正是為了解決這一痛點而設計。但理解事件日誌的工作原理依然是基礎——即使使用索引服務，也需要理解事件結構來正確定義 schema 和映射邏輯。
