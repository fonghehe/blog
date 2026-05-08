---
title: "Web3.js 入门：用 JavaScript 与以太坊交互"
date: 2018-04-03 20:17:15
tags:
  - Web3
  - Ethereum
  - DApp
---

web3.js 是以太坊官方维护的 JavaScript SDK，也是前端工程师进入 DApp 开发的第一道门槛。web3.js 0.20.x 是长期使用的稳定版本，而 1.0 尚处于 beta 阶段。两个版本的 API 设计差异巨大——0.20.x 使用回调函数，1.0 引入了 Promise 和事件发射器，这种版本分裂给开发者带来了不少困惑。

## web3.js 0.x 版本的 API 设计

web3.js 0.20.x 的 API 设计深受 Node.js 早期风格影响，大量使用回调函数而非 Promise。核心模块包括：

- `web3.eth`：以太坊区块链相关操作
- `web3.net`：网络信息
- `web3.personal`：账户管理
- `web3.shh`：Whisper 协议（消息传递）

```javascript
// 0.20.x 的典型回调风格
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

web3.eth.getBlockNumber(function(error, result) {
    if (!error) {
        console.log('Current block:', result);
    } else {
        console.error(error);
    }
});

// 1.0 beta 的 Promise 风格
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

web3.eth.getBlockNumber().then(result => {
    console.log('Current block:', result);
});
```

在实际项目中，由于 0.20.x 不支持 Promise，通常需要手动包装：

```javascript
// 将回调风格 API 包装为 Promise
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

## 连接以太坊节点

web3.js 通过 Provider 抽象层与以太坊节点通信，支持两种主要 Provider：

### HttpProvider

```javascript
// 连接本地节点
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

// 连接远程节点（如 Infura）
var web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/YOUR_API_KEY'));
```

HttpProvider 基于标准 HTTP 请求，每次调用都是独立的请求-响应循环。优点是简单稳定，缺点是无法实现实时事件监听——需要通过轮询模拟。

### IpcProvider

```javascript
// IPC Provider 仅在 Node.js 环境可用，连接本地 Geth/Parity 节点
var net = require('net');
var web3 = new Web3(new Web3.providers.IpcProvider('/path/to/geth.ipc', net));
```

IpcProvider 通过 Unix Domain Socket 通信，比 HTTP 更高效，适合运行本地节点的场景。

### Provider 切换

在 DApp 开发中，通常需要根据环境动态切换 Provider：

```javascript
var Web3 = require('web3');
var web3;

if (typeof web3 !== 'undefined') {
    // MetaMask 注入了 web3 实例
    web3 = new Web3(web3.currentProvider);
} else {
    // 回退到本地节点或远程节点
    web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}
```

## 账户管理

### 创建新账户

```javascript
// 0.20.x 创建账户（注意：仅生成本地账户，不会同步到节点）
var account = web3.eth.accounts.create();
console.log(account.address);   // 0x...
console.log(account.privateKey); // 0x...

// 1.0 beta
web3.eth.accounts.create().then(account => {
    console.log(account.address);
});
```

### 导入 Keystore

Keystore 文件是加密存储的私钥，通过密码解密后获取账户：

```javascript
// 从 Keystore 文件恢复账户
var keythereum = require('keythereum');
var datadir = '/path/to/ethereum/data';
var address = '0x...';
var password = 'your-password';

var keyObject = keythereum.importFromFile(address, datadir);
var privateKey = keythereum.recover(password, keyObject);
console.log('Private key:', privateKey.toString('hex'));
```

### 签名交易

```javascript
// 使用私钥签名并发送交易
var tx = {
    from: '0x...',
    to: '0x...',
    value: web3.utils.toWei('1', 'ether'),
    gas: 21000,
    gasPrice: web3.utils.toWei('10', 'gwei'),
    nonce: 0
};

// 1.0 beta 中使用私钥签名
web3.eth.accounts.signTransaction(tx, privateKey)
    .then(signed => {
        return web3.eth.sendSignedTransaction(signed.rawTransaction);
    })
    .then(receipt => {
        console.log('Transaction mined:', receipt.transactionHash);
    });
```

## 合约实例化

合约实例化需要 ABI（Application Binary Interface）和合约地址。ABI 是 JSON 数组，描述了合约的函数、事件、结构等信息：

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

## 读取链上数据：call 方法

读取操作不上链，不消耗 Gas，使用 `call` 方法：

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

// 从特定地址调用
contract.methods.getValue().call({ from: '0x...' })
    .then(result => console.log(result));
```

`call` 方法还可以传入交易参数，例如指定 `from` 地址来模拟特定用户视角下的状态（当合约逻辑依赖 `msg.sender` 时）。

## 发送交易：send 方法与事件监听

写入操作需要发送交易上链，消耗 Gas。1.0 beta 的 `send` 方法提供了丰富的链式事件监听：

```javascript
// 1.0 beta 发送交易
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
// 0.20.x 发送交易 + 监听事件
contract.setValue('Hello Ethereum', {
    from: web3.eth.accounts[0],
    gas: 200000
}, function(err, txHash) {
    if (!err) {
        // 监听 ValueChanged 事件
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

## 完整的前端 DApp 交互模块

```javascript
// dapp-client.js —— DApp 前端交互层
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

    // 读取合约值
    getValue: function(callback) {
        this.contract.getValue(callback);
    },

    // 写入合约值
    setValue: function(value, callback) {
        var self = this;
        this.contract.setValue(value, {
            from: this.account,
            gas: 200000
        }, function(err, txHash) {
            if (err) return callback(err);

            // 轮询等待交易确认
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

    // 监听合约事件
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

## 常见错误与调试技巧

### BigNumber 问题

web3.js 内部使用 BigNumber.js 处理大数，因为 JavaScript 原生 Number 无法精确表示 uint256：

```javascript
// 错误：直接使用 Number 类型
var balance = web3.eth.getBalance(address); // BigNumber
console.log(balance); // BigNumber object

// 正确：转换为单位后再使用
var etherBalance = web3.fromWei(balance, 'ether').toNumber();
```

### 交易"丢失"

交易发送后没有回执是常见问题。原因通常是 Gas 不足或 nonce 不正确：

```javascript
// 估算 Gas
contract.methods.setValue('test').estimateGas({ from: account })
    .then(gas => {
        console.log('Estimated gas:', gas);
        // 建议设置 gas = estimated * 1.2
    });

// 检查 nonce
web3.eth.getTransactionCount(account)
    .then(nonce => console.log('Next nonce:', nonce));
```

### 事件无法获取

0.20.x 中事件监听依赖节点支持 `eth_getLogs` 和 `eth_subscribe`。如果使用 Infura 的 HTTP 端点，无法实时监听，只能轮询 `getPastEvents`：

```javascript
// 轮询获取历史事件
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

## 与 JSON-RPC 接口的底层关系

web3.js 本质上是对以太坊 JSON-RPC 接口的封装。每个 web3.js 方法调用最终都会转换为 HTTP POST 请求：

```javascript
// web3.js 调用
web3.eth.getBalance('0x...');

// 底层发送的 JSON-RPC 请求
// POST http://localhost:8545
// {
//     "jsonrpc": "2.0",
//     "method": "eth_getBalance",
//     "params": ["0x...", "latest"],
//     "id": 1
// }
```

理解这一点很重要，因为：

1. **RPC 方法映射**：web3.js 的每个方法都对应一个 JSON-RPC method，如 `eth_sendTransaction`、`eth_call`、`eth_getLogs` 等
2. **节点限制**：某些公共节点可能禁用某些 RPC 方法（如 `personal_*`）
3. **直接使用 JSON-RPC**：在极端情况下可以绕过 web3.js 直接发送 RPC 请求

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

// 直接获取余额
rpcCall('eth_getBalance', ['0x...', 'latest']).then(result => {
    console.log('Balance:', parseInt(result, 16));
});
```

## 小结

web3.js 是 DApp 前端开发的基础设施，但它远非一个成熟的库。0.20.x 和 1.0 beta 的并存让开发者不得不处理两套 API 文档；回调地狱需要手动 Promise 化；BigNumber 的使用容易出错；事件监听在不同 Provider 上行为不一致。

从架构层面看，web3.js 的设计反映了以太坊本身的复杂性——它需要同时处理交易签名、ABI 编解码、事件过滤、单位转换等任务，而每个环节都有可能出错。理解这些 API 背后的 JSON-RPC 机制比记忆 API 本身更重要，因为当库出现问题时，最终都需要回到协议层面排查。

ethers.js 以更清晰的类型设计、更一致的 API 风格和更完善的文档，解决了 web3.js 的诸多痛点。理解 web3.js 的设计缺陷，有助于把握以太坊前端开发工具链的演进脉络。
