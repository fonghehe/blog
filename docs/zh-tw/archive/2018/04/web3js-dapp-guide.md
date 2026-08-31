---
readingTime: 6
wordCount: 1027
title: "Web3.js 入門：用 JavaScript 與以太坊交互"
date: 2018-04-03 20:17:15
tags:
  - Web3
  - Ethereum
  - DApp
description: "web3.js 是以太坊官方維護的 JavaScript SDK，也是前端工程師進入 DApp 開發的第一道門檻。web3.js 0.20.x 是長期使用的穩定版本，而 1.0 beta 版本已經發布，兩者 API 設計差異巨大——0.20.x 使用回調函數，1.0 引入了 Promise 和事件發射器。理解這種差異對"
---

web3.js 是以太坊官方維護的 JavaScript SDK，也是前端工程師進入 DApp 開發的第一道門檻。web3.js 0.20.x 是長期使用的穩定版本，而 1.0 beta 版本已經發布，兩者 API 設計差異巨大——0.20.x 使用回調函數，1.0 引入了 Promise 和事件發射器。理解這種差異對開發者處理不同項目至關重要。

## web3.js 0.x 版本的 API 設計

web3.js 0.20.x 的 API 設計深受 Node.js 早期風格影響，大量使用回調函數而非 Promise。核心模塊包括：

- `web3.eth`：以太坊區塊鏈相關操作
- `web3.net`：網絡信息
- `web3.personal`：賬戶管理
- `web3.shh`：Whisper 協議（消息傳遞）

```javascript
// 0.20.x 的典型回調風格
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

web3.eth.getBlockNumber(function(error, result) {
    if (!error) {
        console.log('Current block:', result);
    } else {
        console.error(error);
    }
});

// 1.0 beta 的 Promise 風格
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

web3.eth.getBlockNumber().then(result => {
    console.log('Current block:', result);
});
```

在實際項目中，由於 0.20.x 不支持 Promise，通常需要手動包裝：

```javascript
// 將回調風格 API 包裝為 Promise
function promisify(fn) {
    return function(...args) {
        return new Promise((resolve, reject) => {
            fn.apply(null, [...args, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            }]);
        });
    };
}

const getBalance = promisify(web3.eth.getBalance);
const getBlockNumber = promisify(web3.eth.getBlockNumber);
```

## 連接以太坊節點

web3.js 通過 Provider 抽象層與以太坊節點通信，支持兩種主要 Provider：

### HttpProvider

```javascript
// 連接本地節點
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

// 連接遠程節點（如 Infura）
var web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/YOUR_API_KEY'));
```

HttpProvider 基於標準 HTTP 請求，每次調用都是獨立的請求-響應循環。優點是簡單穩定，缺點是無法實現實時事件監聽——需要通過輪詢模擬。

### IpcProvider

```javascript
// IPC Provider 僅在 Node.js 環境可用，連接本地 Geth/Parity 節點
var net = require('net');
var web3 = new Web3(new Web3.providers.IpcProvider('/path/to/geth.ipc', net));
```

IpcProvider 通過 Unix Domain Socket 通信，比 HTTP 更高效，適合運行本地節點的場景。

### Provider 切換

在 DApp 開發中，通常需要根據環境動態切換 Provider：

```javascript
var Web3 = require('web3');
var web3;

if (typeof web3 !== 'undefined') {
    // MetaMask 注入了 web3 實例
    web3 = new Web3(web3.currentProvider);
} else {
    // 回退到本地節點或遠程節點
    web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}
```

## 賬戶管理

### 創建新賬戶

```javascript
// 0.20.x 創建賬戶（注意：僅生成本地賬戶，不會同步到節點）
var account = web3.eth.accounts.create();
console.log(account.address);   // 0x...
console.log(account.privateKey); // 0x...

// 1.0 beta
web3.eth.accounts.create().then(account => {
    console.log(account.address);
});
```

### 導入 Keystore

Keystore 文件是加密存儲的私鑰，通過密碼解密後獲取賬戶：

```javascript
// 從 Keystore 文件恢復賬戶
var keythereum = require('keythereum');
var datadir = '/path/to/ethereum/data';
var address = '0x...';
var password = 'your-password';

var keyObject = keythereum.importFromFile(address, datadir);
var privateKey = keythereum.recover(password, keyObject);
console.log('Private key:', privateKey.toString('hex'));
```

### 簽名交易

```javascript
// 使用私鑰簽名併發送交易
var tx = {
    from: '0x...',
    to: '0x...',
    value: web3.utils.toWei('1', 'ether'),
    gas: 21000,
    gasPrice: web3.utils.toWei('10', 'gwei'),
    nonce: 0
};

// 1.0 beta 中使用私鑰簽名
web3.eth.accounts.signTransaction(tx, privateKey)
    .then(signed => {
        return web3.eth.sendSignedTransaction(signed.rawTransaction);
    })
    .then(receipt => {
        console.log('Transaction mined:', receipt.transactionHash);
    });
```

## 合約實例化

合約實例化需要 ABI（Application Binary Interface）和合約地址。ABI 是 JSON 數組，描述了合約的函數、事件、結構等信息：

```javascript
var abi = [{
    "constant": true,
    "inputs": [],
    "name": "getValue",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
}, {
    "constant": false,
    "inputs": [{"name": "_value", "type": "string"}],
    "name": "setValue",
    "outputs": [],
    "type": "function"
}, {
    "anonymous": false,
    "inputs": [{"indexed": false, "name": "value", "type": "string"}],
    "name": "ValueChanged",
    "type": "event"
}];

var contractAddress = '0x1234567890abcdef...';

// 0.20.x 方式
var contract = web3.eth.contract(abi).at(contractAddress);

// 1.0 beta 方式
var contract = new web3.eth.Contract(abi, contractAddress);
```

## 讀取鏈上數據：call 方法

讀取操作不上鍊，不消耗 Gas，使用 `call` 方法：

```javascript
// 0.20.x
contract.getValue(function(err, result) {
    if (!err) {
        console.log('Value:', result);
    }
});

// 1.0 beta
contract.methods.getValue().call()
    .then(result => {
        console.log('Value:', result);
    });

// 從特定地址調用
contract.methods.getValue().call({ from: '0x...' })
    .then(result => console.log(result));
```

`call` 方法還可以傳入交易參數，例如指定 `from` 地址來模擬特定用戶視角下的狀態（當合約邏輯依賴 `msg.sender` 時）。

## 發送交易：send 方法與事件監聽

寫入操作需要發送交易上鍊，消耗 Gas。1.0 beta 的 `send` 方法提供了豐富的鏈式事件監聽：

```javascript
// 1.0 beta 發送交易
contract.methods.setValue('Hello Ethereum').send({
    from: '0x...',
    gas: 200000,
    gasPrice: web3.utils.toWei('10', 'gwei')
})
.on('transactionHash', function(hash) {
    console.log('Transaction sent:', hash);
})
.on('receipt', function(receipt) {
    console.log('Transaction mined:', receipt.transactionHash);
})
.on('confirmation', function(confirmationNumber, receipt) {
    console.log('Confirmations:', confirmationNumber);
})
.on('error', function(error) {
    console.error('Transaction failed:', error);
});
```

```javascript
// 0.20.x 發送交易 + 監聽事件
contract.setValue('Hello Ethereum', {
    from: web3.eth.accounts[0],
    gas: 200000
}, function(err, txHash) {
    if (!err) {
        // 監聽 ValueChanged 事件
        var event = contract.ValueChanged();
        event.watch(function(error, result) {
            if (!error) {
                console.log('Value changed to:', result.args.value);
                console.log('By:', result.args.changer);
                event.stopWatching();
            }
        });
    }
});
```

## 完整的前端 DApp 交互模塊

```javascript
// dapp-client.js —— DApp 前端交互層
var Web3 = require('web3');
var contractAbi = require('./abi.json');

var DAppClient = {
    web3: null,
    contract: null,
    account: null,

    init: function(provider, contractAddress) {
        this.web3 = new Web3(provider);
        this.contract = this.web3.eth.contract(contractAbi).at(contractAddress);
        return this;
    },

    getAccount: function(callback) {
        var self = this;
        this.web3.eth.getAccounts(function(err, accounts) {
            if (err) return callback(err);
            self.account = accounts[0];
            callback(null, accounts[0]);
        });
    },

    getBalance: function(address, callback) {
        this.web3.eth.getBalance(address, function(err, balance) {
            if (err) return callback(err);
            callback(null, this.web3.fromWei(balance, 'ether').toNumber());
        }.bind(this));
    },

    // 讀取合約值
    getValue: function(callback) {
        this.contract.getValue(callback);
    },

    // 寫入合約值
    setValue: function(value, callback) {
        var self = this;
        this.contract.setValue(value, {
            from: this.account,
            gas: 200000
        }, function(err, txHash) {
            if (err) return callback(err);

            // 輪詢等待交易確認
            var filter = self.web3.eth.filter('latest');
            filter.watch(function(error) {
                if (error) return;
                self.web3.eth.getTransactionReceipt(txHash, function(err, receipt) {
                    if (receipt && receipt.blockNumber) {
                        filter.stopWatching();
                        callback(null, receipt);
                    }
                });
            });
        });
    },

    // 監聽合約事件
    watchEvent: function(eventName, callback) {
        var event = this.contract[eventName]({}, { fromBlock: 0, toBlock: 'latest' });
        event.watch(function(error, result) {
            if (!error) {
                callback(result.args);
            }
        });
        return event;
    }
};

module.exports = DAppClient;
```

## 常見錯誤與調試技巧

### BigNumber 問題

web3.js 內部使用 BigNumber.js 處理大數，因為 JavaScript 原生 Number 無法精確表示 uint256：

```javascript
// 錯誤：直接使用 Number 類型
var balance = web3.eth.getBalance(address); // BigNumber
console.log(balance); // BigNumber object

// 正確：轉換為單位後再使用
var etherBalance = web3.fromWei(balance, 'ether').toNumber();
```

### 交易"丟失"

交易發送後沒有回執是常見問題。原因通常是 Gas 不足或 nonce 不正確：

```javascript
// 估算 Gas
contract.methods.setValue('test').estimateGas({ from: account })
    .then(gas => {
        console.log('Estimated gas:', gas);
        // 建議設置 gas = estimated * 1.2
    });

// 檢查 nonce
web3.eth.getTransactionCount(account)
    .then(nonce => console.log('Next nonce:', nonce));
```

### 事件無法獲取

0.20.x 中事件監聽依賴節點支持 `eth_getLogs` 和 `eth_subscribe`。如果使用 Infura 的 HTTP 端點，無法實時監聽，只能輪詢 `getPastEvents`：

```javascript
// 輪詢獲取歷史事件
function pollEvents(contract, eventName, lastBlock) {
    var event = contract[eventName]({}, { fromBlock: lastBlock, toBlock: 'latest' });
    event.get(function(error, logs) {
        if (!error && logs.length > 0) {
            logs.forEach(log => console.log(log));
        }
        setTimeout(() => pollEvents(contract, eventName, lastBlock + 1), 5000);
    });
}
```

## 與 JSON-RPC 接口的底層關係

web3.js 本質上是對以太坊 JSON-RPC 接口的封裝。每個 web3.js 方法調用最終都會轉換為 HTTP POST 請求：

```javascript
// web3.js 調用
web3.eth.getBalance('0x...');

// 底層發送的 JSON-RPC 請求
// POST http://localhost:8545
// {
//     "jsonrpc": "2.0",
//     "method": "eth_getBalance",
//     "params": ["0x...", "latest"],
//     "id": 1
// }
```

理解這一點很重要，因為：

1. **RPC 方法映射**：web3.js 的每個方法都對應一個 JSON-RPC method，如 `eth_sendTransaction`、`eth_call`、`eth_getLogs` 等
2. **節點限制**：某些公共節點可能禁用某些 RPC 方法（如 `personal_*`）
3. **直接使用 JSON-RPC**：在極端情況下可以繞過 web3.js 直接發送 RPC 請求

```javascript
// 直接使用 JSON-RPC
var request = require('request');

function rpcCall(method, params) {
    return new Promise((resolve, reject) => {
        request({
            url: 'http://localhost:8545',
            method: 'POST',
            json: {
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: 1
            }
        }, function(error, response, body) {
            if (error) reject(error);
            else resolve(body.result);
        });
    });
}

// 直接獲取餘額
rpcCall('eth_getBalance', ['0x...', 'latest']).then(result => {
    console.log('Balance:', parseInt(result, 16));
});
```

## 小結

web3.js 是 DApp 前端開發的基礎設施，但它遠非一個成熟的庫。0.20.x 和 1.0 beta 的並存讓開發者不得不處理兩套 API 文檔；回調地獄需要手動 Promise 化；BigNumber 的使用容易出錯；事件監聽在不同 Provider 上行為不一致。

從架構層面看，web3.js 的設計反映了以太坊本身的複雜性——它需要同時處理交易簽名、ABI 編解碼、事件過濾、單位轉換等任務，而每個環節都有可能出錯。理解這些 API 背後的 JSON-RPC 機制比記憶 API 本身更重要，因為當庫出現問題時，最終都需要回到協議層面排查。

ethers.js 提供了更清晰的類型設計、更一致的 API 風格與更完善的文檔，解決了 web3.js 的諸多痛點，成為另一個主流選擇。理解 web3.js 的設計權衡與侷限，有助於掌握以太坊前端開發的底層概念。
