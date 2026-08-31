---
title: "Getting Started with Web3.js: Interacting with Ethereum Using JavaScript"
date: 2018-04-03 20:17:15
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 6
wordCount: 667
description: "web3.js is the official JavaScript SDK maintained by Ethereum, and it is the first hurdle for frontend engineers entering DApp development. It spans two major A"
---

web3.js is the official JavaScript SDK maintained by Ethereum, and it is the first hurdle for frontend engineers entering DApp development. It spans two major API generations: 0.20.x, which uses callback functions, and the 1.0 line, which introduced Promises and event emitters. Understanding how both styles work—and how to bridge them—matters whenever you maintain or integrate with existing DApp code.

## API Design of web3.js 0.x

The API design of web3.js 0.20.x was heavily influenced by classic Node.js conventions, extensively using callback functions rather than Promises. The core modules include:

- `web3.eth`: Ethereum blockchain operations
- `web3.net`: Network information
- `web3.personal`: Account management
- `web3.shh`: Whisper protocol (messaging)

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

In actual projects, since 0.20.x did not support Promises, manual wrapping was typically required:

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

## Connecting to an Ethereum Node

web3.js communicates with Ethereum nodes through a Provider abstraction layer, supporting two main types of providers:

### HttpProvider

```javascript
// 连接本地节点
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

// 连接远程节点（如 Infura）
var web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/YOUR_API_KEY'));
```

HttpProvider is based on standard HTTP requests, where each call is an independent request-response cycle. The advantage is simplicity and stability; the disadvantage is the inability to implement real-time event listening—polling is required to simulate it.

### IpcProvider

```javascript
// IPC Provider 仅在 Node.js 环境可用，连接本地 Geth/Parity 节点
var net = require('net');
var web3 = new Web3(new Web3.providers.IpcProvider('/path/to/geth.ipc', net));
```

IpcProvider communicates via Unix Domain Socket, which is more efficient than HTTP and suitable for scenarios running a local node.

### Provider Switching

In DApp development, it is often necessary to dynamically switch providers based on the environment:

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

## Account Management

### Creating a New Account

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

### Importing a Keystore

A keystore file is an encrypted private key. After decrypting with a password, the account is obtained:

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

### Signing Transactions

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

## Contract Instantiation

Contract instantiation requires the ABI (Application Binary Interface) and the contract address. The ABI is a JSON array describing the contract's functions, events, structs, and other information:

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

## Reading On-Chain Data: The call Method

Read operations do not go on-chain, do not consume gas, and use the `call` method:

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

The `call` method can also accept transaction parameters, such as specifying a `from` address to simulate the state from a specific user's perspective (when the contract logic depends on `msg.sender`).

## Sending Transactions: The send Method and Event Listening

Write operations require sending on-chain transactions that consume gas. The 1.0 beta `send` method provides rich chained event listening:

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

## A Complete Frontend DApp Interaction Module

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

## Common Errors and Debugging Tips

### BigNumber Issues

web3.js uses BigNumber.js internally to handle large numbers, because JavaScript's native Number type cannot accurately represent uint256:

```javascript
// 错误：直接使用 Number 类型
var balance = web3.eth.getBalance(address); // BigNumber
console.log(balance); // BigNumber object

// 正确：转换为单位后再使用
var etherBalance = web3.fromWei(balance, 'ether').toNumber();
```

### Transaction "Disappearance"

A common issue is sending a transaction and receiving no receipt. The cause is typically insufficient gas or an incorrect nonce:

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

### Unable to Retrieve Events

In 0.20.x, event listening depends on the node supporting `eth_getLogs` and `eth_subscribe`. If using Infura's HTTP endpoint, real-time listening is not possible—only polling via `getPastEvents`:

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

## The Underlying Relationship with the JSON-RPC Interface

web3.js is essentially a wrapper around Ethereum's JSON-RPC interface. Every web3.js method call is ultimately converted into an HTTP POST request:

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

Understanding this is important because:

1. **RPC method mapping**: Every web3.js method corresponds to a JSON-RPC method, such as `eth_sendTransaction`, `eth_call`, `eth_getLogs`, etc.
2. **Node limitations**: Some public nodes may disable certain RPC methods (e.g., `personal_*`)
3. **Using JSON-RPC directly**: In extreme cases, you can bypass web3.js and send RPC requests directly

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

## Summary

web3.js is the foundational infrastructure for DApp frontend development, but it comes with sharp edges. The coexistence of 0.20.x and the 1.0 line means you must deal with two sets of API documentation; callback hell requires manual Promise wrapping; BigNumber usage is error-prone; and event listening behaves inconsistently across different providers.

From an architectural perspective, web3.js's design reflects Ethereum's own complexity—it needs to handle transaction signing, ABI encoding/decoding, event filtering, and unit conversion simultaneously, and each of these steps can go wrong. Understanding the JSON-RPC mechanism behind these APIs is more important than memorizing the APIs themselves, because when the library has issues, you ultimately need to troubleshoot at the protocol level.

ethers.js later emerged to address many of web3.js's pain points with clearer type design, more consistent API style, and better documentation. For a long period web3.js was the dominant choice, and understanding its design trade-offs helps you reason about the broader Ethereum frontend ecosystem.
